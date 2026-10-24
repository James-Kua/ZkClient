package main

import (
	"errors"
	"fmt"
	"log"
	"net"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-zookeeper/zk"
)

const (
	sessionTimeout = 30 * time.Second
	connectTimeout = 10 * time.Second
)

type ZkStat struct {
	Czxid          string `json:"czxid"`
	Mzxid          string `json:"mzxid"`
	Pzxid          string `json:"pzxid"`
	Ctime          int64  `json:"ctime"` // unix millis
	Mtime          int64  `json:"mtime"`
	Version        int32  `json:"version"`
	Cversion       int32  `json:"cversion"`
	Aversion       int32  `json:"aversion"`
	EphemeralOwner string `json:"ephemeralOwner"`
	DataLength     int32  `json:"dataLength"`
	NumChildren    int32  `json:"numChildren"`
}

type ZkNode struct {
	Path string `json:"path"`
	Data string `json:"data"`
	Stat ZkStat `json:"stat"`
}

type ChildInfo struct {
	Name        string `json:"name"`
	NumChildren int32  `json:"numChildren"`
}

type ZkService struct {
	conn      *zk.Conn
	chroot    string
	done      chan struct{}
	closeOnce sync.Once
}

// NewZkService connects and waits until a session is established. onState is
// called whenever the session is gained or lost after that.
func NewZkService(connectionString string, tunnel *SshTunnel, onState func(connected bool)) (*ZkService, error) {
	hosts, chroot := splitConnectionString(connectionString)
	if len(hosts) == 0 {
		return nil, errors.New("connection string is empty")
	}

	dial := zk.Dialer(net.DialTimeout)
	if tunnel != nil {
		dial = func(network, addr string, _ time.Duration) (net.Conn, error) {
			return tunnel.Dial(network, addr)
		}
	}

	conn, events, err := zk.Connect(hosts, sessionTimeout, zk.WithDialer(dial), zk.WithLogger(quietLogger{}))
	if err != nil {
		return nil, err
	}

	s := &ZkService{conn: conn, chroot: chroot, done: make(chan struct{})}

	timeout := time.After(connectTimeout)
	for {
		select {
		case ev := <-events:
			if ev.State == zk.StateAuthFailed {
				conn.Close()
				return nil, errors.New("authentication failed")
			}
			if ev.State != zk.StateHasSession {
				continue
			}
			onState(true)
			go s.watchState(events, onState)
			return s, nil
		case <-timeout:
			conn.Close()
			return nil, fmt.Errorf("timed out connecting to %s", strings.Join(hosts, ","))
		}
	}
}

func (s *ZkService) watchState(events <-chan zk.Event, onState func(bool)) {
	connected := true
	for {
		select {
		case ev, ok := <-events:
			if !ok {
				return
			}
			switch ev.State {
			case zk.StateHasSession:
				if !connected {
					connected = true
					onState(true)
				}
			case zk.StateDisconnected, zk.StateExpired:
				if connected {
					connected = false
					onState(false)
				}
			}
		case <-s.done:
			return
		}
	}
}

func (s *ZkService) Close() {
	s.closeOnce.Do(func() {
		close(s.done)
		s.conn.Close()
	})
}

func (s *ZkService) full(path string) string {
	if s.chroot == "" {
		return path
	}
	if path == "/" {
		return s.chroot
	}
	return s.chroot + path
}

func (s *ZkService) rel(path string) string {
	if s.chroot == "" {
		return path
	}
	if p := strings.TrimPrefix(path, s.chroot); p != "" {
		return p
	}
	return "/"
}

func joinPath(parent, name string) string {
	if parent == "/" {
		return "/" + name
	}
	return parent + "/" + name
}

// GetChildren returns children sorted by name, each with its child count so the
// tree knows which nodes are expandable. The Exists calls are pipelined by the
// client, so this costs roughly one round trip regardless of fan-out.
func (s *ZkService) GetChildren(path string) ([]ChildInfo, error) {
	names, _, err := s.conn.Children(s.full(path))
	if err != nil {
		return nil, wrap(path, err)
	}
	sort.Strings(names)

	out := make([]ChildInfo, len(names))
	var wg sync.WaitGroup
	for i, name := range names {
		out[i].Name = name
		wg.Add(1)
		go func(i int, name string) {
			defer wg.Done()
			if _, stat, err := s.conn.Exists(s.full(joinPath(path, name))); err == nil && stat != nil {
				out[i].NumChildren = stat.NumChildren
			}
		}(i, name)
	}
	wg.Wait()
	return out, nil
}

func (s *ZkService) GetNode(path string) (*ZkNode, error) {
	data, stat, err := s.conn.Get(s.full(path))
	if err != nil {
		return nil, wrap(path, err)
	}
	return &ZkNode{
		Path: path,
		Data: string(data),
		Stat: ZkStat{
			Czxid:          strconv.FormatInt(stat.Czxid, 10),
			Mzxid:          strconv.FormatInt(stat.Mzxid, 10),
			Pzxid:          strconv.FormatInt(stat.Pzxid, 10),
			Ctime:          stat.Ctime,
			Mtime:          stat.Mtime,
			Version:        stat.Version,
			Cversion:       stat.Cversion,
			Aversion:       stat.Aversion,
			EphemeralOwner: strconv.FormatInt(stat.EphemeralOwner, 10),
			DataLength:     stat.DataLength,
			NumChildren:    stat.NumChildren,
		},
	}, nil
}

func (s *ZkService) CreateNode(path, data string, ephemeral, sequential bool) (string, error) {
	var flags int32
	if ephemeral {
		flags |= zk.FlagEphemeral
	}
	if sequential {
		flags |= zk.FlagSequence
	}
	created, err := s.conn.Create(s.full(path), []byte(data), flags, zk.WorldACL(zk.PermAll))
	if err != nil {
		return "", wrap(path, err)
	}
	return s.rel(created), nil
}

// SetData writes only if the node is still at the given version (-1 skips the
// check), so an edit can't silently clobber someone else's change.
func (s *ZkService) SetData(path, data string, version int32) error {
	_, err := s.conn.Set(s.full(path), []byte(data), version)
	if errors.Is(err, zk.ErrBadVersion) {
		return fmt.Errorf("%s was modified by someone else since you opened it; refresh and try again", path)
	}
	return wrap(path, err)
}

func (s *ZkService) Delete(path string, recursive bool) error {
	if path == "/" {
		return errors.New("cannot delete the root node")
	}
	if recursive {
		children, _, err := s.conn.Children(s.full(path))
		if err != nil {
			return wrap(path, err)
		}
		for _, c := range children {
			if err := s.Delete(joinPath(path, c), true); err != nil {
				return err
			}
		}
	}
	err := s.conn.Delete(s.full(path), -1)
	if errors.Is(err, zk.ErrNotEmpty) {
		return fmt.Errorf("%s has children; delete them first or use recursive delete", path)
	}
	return wrap(path, err)
}

func wrap(path string, err error) error {
	if err == nil {
		return nil
	}
	return fmt.Errorf("%s: %w", path, err)
}

// splitConnectionString parses "h1:2181,h2:2181/chroot" into hosts and chroot.
func splitConnectionString(s string) ([]string, string) {
	s = strings.TrimSpace(s)
	chroot := chrootOf(s)
	s = strings.TrimSuffix(s, chroot)

	var hosts []string
	for _, h := range strings.Split(s, ",") {
		if h = strings.TrimSpace(h); h == "" {
			continue
		}
		if _, _, err := net.SplitHostPort(h); err != nil {
			h = net.JoinHostPort(h, "2181")
		}
		hosts = append(hosts, h)
	}
	return hosts, strings.TrimSuffix(chroot, "/")
}

func chrootOf(s string) string {
	if i := strings.Index(s, "/"); i >= 0 {
		return strings.TrimSpace(s[i:])
	}
	return ""
}

func joinHostPort(host string, port int) string {
	if port == 0 {
		port = 2181
	}
	return net.JoinHostPort(host, strconv.Itoa(port))
}

// quietLogger drops the client's per-reconnect chatter but keeps it available
// when running `wails dev` with ZK_DEBUG set.
type quietLogger struct{}

func (quietLogger) Printf(format string, args ...interface{}) {
	if debugLogging {
		log.Printf("zk: "+format, args...)
	}
}
