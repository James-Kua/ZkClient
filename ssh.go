package main

import (
	"fmt"
	"net"
	"os"
	"strconv"
	"time"

	"golang.org/x/crypto/ssh"
)

var debugLogging = os.Getenv("ZK_DEBUG") != ""

// SshTunnel forwards ZooKeeper connections through an SSH server. Rather than
// listening on a local port, the ZK client dials through it directly.
type SshTunnel struct {
	client *ssh.Client
}

func OpenSshTunnel(cfg SshTunnelConfig) (*SshTunnel, error) {
	var auth []ssh.AuthMethod
	if cfg.PrivateKey != "" {
		var (
			signer ssh.Signer
			err    error
		)
		if cfg.Passphrase != "" {
			signer, err = ssh.ParsePrivateKeyWithPassphrase([]byte(cfg.PrivateKey), []byte(cfg.Passphrase))
		} else {
			signer, err = ssh.ParsePrivateKey([]byte(cfg.PrivateKey))
		}
		if err != nil {
			return nil, fmt.Errorf("invalid private key: %w", err)
		}
		auth = append(auth, ssh.PublicKeys(signer))
	}
	if cfg.Password != "" {
		auth = append(auth, ssh.Password(cfg.Password), ssh.KeyboardInteractive(
			func(_, _ string, questions []string, _ []bool) ([]string, error) {
				answers := make([]string, len(questions))
				for i := range answers {
					answers[i] = cfg.Password
				}
				return answers, nil
			}))
	}

	port := cfg.Port
	if port == 0 {
		port = 22
	}
	client, err := ssh.Dial("tcp", net.JoinHostPort(cfg.Host, strconv.Itoa(port)), &ssh.ClientConfig{
		User: cfg.Username,
		Auth: auth,
		// Matches the previous Electron behaviour (ssh2 accepted any host key).
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         10 * time.Second,
	})
	if err != nil {
		return nil, fmt.Errorf("SSH connection failed: %w", err)
	}
	return &SshTunnel{client: client}, nil
}

func (t *SshTunnel) Dial(network, addr string) (net.Conn, error) {
	return t.client.Dial(network, addr)
}

func (t *SshTunnel) Close() {
	t.client.Close()
}
