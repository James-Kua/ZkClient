package main

import (
	"fmt"
	"net"
	"os"
	"testing"
	"time"
)

// Integration test against a real server; set ZK_TEST_ADDR or run one on localhost:2181.
func testService(t *testing.T, chroot string) *ZkService {
	addr := os.Getenv("ZK_TEST_ADDR")
	if addr == "" {
		addr = "localhost:2181"
	}
	if c, err := net.DialTimeout("tcp", addr, time.Second); err != nil {
		t.Skipf("no ZooKeeper at %s", addr)
	} else {
		c.Close()
	}
	svc, err := NewZkService(addr+chroot, nil, func(bool) {})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(svc.Close)
	return svc
}

func TestCrudAndRecursiveDelete(t *testing.T) {
	svc := testService(t, "")
	root := fmt.Sprintf("/zkclient-test-%d", time.Now().UnixNano())
	t.Cleanup(func() { svc.Delete(root, true) })

	if _, err := svc.CreateNode(root, "hello", false, false); err != nil {
		t.Fatal(err)
	}
	for _, c := range []string{"b", "a"} {
		if _, err := svc.CreateNode(root+"/"+c, "", false, false); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := svc.CreateNode(root+"/a/deep", "", false, false); err != nil {
		t.Fatal(err)
	}

	children, err := svc.GetChildren(root)
	if err != nil {
		t.Fatal(err)
	}
	if len(children) != 2 || children[0].Name != "a" || children[0].NumChildren != 1 || children[1].NumChildren != 0 {
		t.Fatalf("unexpected children: %+v", children)
	}

	node, err := svc.GetNode(root)
	if err != nil {
		t.Fatal(err)
	}
	if node.Data != "hello" || node.Stat.NumChildren != 2 || node.Stat.Ctime == 0 {
		t.Fatalf("unexpected node: %+v", node)
	}

	if err := svc.SetData(root, "v1", node.Stat.Version); err != nil {
		t.Fatal(err)
	}
	if err := svc.SetData(root, "stale", node.Stat.Version); err == nil {
		t.Fatal("expected version conflict")
	}

	seq, err := svc.CreateNode(root+"/seq-", "", true, true)
	if err != nil {
		t.Fatal(err)
	}
	if len(seq) != len(root+"/seq-")+10 {
		t.Fatalf("unexpected sequential path %q", seq)
	}

	if err := svc.Delete(root, false); err == nil {
		t.Fatal("expected non-recursive delete of non-empty node to fail")
	}
	if err := svc.Delete(root, true); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.GetNode(root); err == nil {
		t.Fatal("node still exists after recursive delete")
	}
}

func TestChroot(t *testing.T) {
	base := testService(t, "")
	root := fmt.Sprintf("/zkclient-chroot-%d", time.Now().UnixNano())
	if _, err := base.CreateNode(root, "", false, false); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { base.Delete(root, true) })

	svc := testService(t, root)
	created, err := svc.CreateNode("/child", "x", false, false)
	if err != nil {
		t.Fatal(err)
	}
	if created != "/child" {
		t.Fatalf("created path not relative to chroot: %q", created)
	}
	children, err := svc.GetChildren("/")
	if err != nil || len(children) != 1 || children[0].Name != "child" {
		t.Fatalf("children of chroot root: %+v, %v", children, err)
	}
	if n, err := base.GetNode(root + "/child"); err != nil || n.Data != "x" {
		t.Fatalf("node not under chroot: %+v, %v", n, err)
	}
}

func TestSplitConnectionString(t *testing.T) {
	hosts, chroot := splitConnectionString(" zk1:2181, zk2 ,zk3:2182/app/ ")
	if fmt.Sprint(hosts) != "[zk1:2181 zk2:2181 zk3:2182]" || chroot != "/app" {
		t.Fatalf("got %v %q", hosts, chroot)
	}
}
