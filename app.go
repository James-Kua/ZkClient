package main

import (
	"context"
	"errors"
	"sync"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App is bound to the frontend; every exported method becomes a JS function
// in frontend/wailsjs/go/main/App. Returned errors reject the JS promise.
type App struct {
	ctx context.Context

	mu     sync.Mutex
	zk     *ZkService
	tunnel *SshTunnel
}

type SshTunnelConfig struct {
	Enabled    bool   `json:"enabled"`
	Host       string `json:"host"`
	Port       int    `json:"port"`
	Username   string `json:"username"`
	Password   string `json:"password,omitempty"`
	PrivateKey string `json:"privateKey,omitempty"`
	Passphrase string `json:"passphrase,omitempty"`
	RemoteHost string `json:"remoteHost"`
	RemotePort int    `json:"remotePort"`
}

type ConnectionConfig struct {
	ConnectionString string           `json:"connectionString"`
	SshTunnel        *SshTunnelConfig `json:"sshTunnel,omitempty"`
}

var errNotConnected = errors.New("not connected")

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) shutdown(context.Context) {
	a.Disconnect()
}

func (a *App) Connect(cfg ConnectionConfig) error {
	a.Disconnect()

	var tunnel *SshTunnel
	servers := cfg.ConnectionString
	if t := cfg.SshTunnel; t != nil && t.Enabled {
		var err error
		if tunnel, err = OpenSshTunnel(*t); err != nil {
			return err
		}
		// Every ZK dial goes through the tunnel to the remote address,
		// so the connection string only needs to carry the chroot (if any).
		servers = joinHostPort(t.RemoteHost, t.RemotePort) + chrootOf(cfg.ConnectionString)
	}

	svc, err := NewZkService(servers, tunnel, func(connected bool) {
		if connected {
			runtime.EventsEmit(a.ctx, "zk:connected")
		} else {
			runtime.EventsEmit(a.ctx, "zk:disconnected")
		}
	})
	if err != nil {
		if tunnel != nil {
			tunnel.Close()
		}
		return err
	}

	a.mu.Lock()
	a.zk, a.tunnel = svc, tunnel
	a.mu.Unlock()
	return nil
}

func (a *App) Disconnect() {
	a.mu.Lock()
	svc, tunnel := a.zk, a.tunnel
	a.zk, a.tunnel = nil, nil
	a.mu.Unlock()

	if svc != nil {
		svc.Close()
	}
	if tunnel != nil {
		tunnel.Close()
	}
}

func (a *App) service() (*ZkService, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.zk == nil {
		return nil, errNotConnected
	}
	return a.zk, nil
}

func (a *App) GetChildren(path string) ([]ChildInfo, error) {
	svc, err := a.service()
	if err != nil {
		return nil, err
	}
	return svc.GetChildren(path)
}

func (a *App) GetNode(path string) (*ZkNode, error) {
	svc, err := a.service()
	if err != nil {
		return nil, err
	}
	return svc.GetNode(path)
}

func (a *App) CreateNode(path, data string, ephemeral, sequential bool) (string, error) {
	svc, err := a.service()
	if err != nil {
		return "", err
	}
	return svc.CreateNode(path, data, ephemeral, sequential)
}

func (a *App) SetNodeData(path, data string, version int32) error {
	svc, err := a.service()
	if err != nil {
		return err
	}
	return svc.SetData(path, data, version)
}

func (a *App) DeleteNode(path string, recursive bool) error {
	svc, err := a.service()
	if err != nil {
		return err
	}
	return svc.Delete(path, recursive)
}
