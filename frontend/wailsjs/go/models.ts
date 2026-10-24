export namespace main {
	
	export class ChildInfo {
	    name: string;
	    numChildren: number;
	
	    static createFrom(source: any = {}) {
	        return new ChildInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.numChildren = source["numChildren"];
	    }
	}
	export class SshTunnelConfig {
	    enabled: boolean;
	    host: string;
	    port: number;
	    username: string;
	    password?: string;
	    privateKey?: string;
	    passphrase?: string;
	    remoteHost: string;
	    remotePort: number;
	
	    static createFrom(source: any = {}) {
	        return new SshTunnelConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
	        this.host = source["host"];
	        this.port = source["port"];
	        this.username = source["username"];
	        this.password = source["password"];
	        this.privateKey = source["privateKey"];
	        this.passphrase = source["passphrase"];
	        this.remoteHost = source["remoteHost"];
	        this.remotePort = source["remotePort"];
	    }
	}
	export class ConnectionConfig {
	    connectionString: string;
	    sshTunnel?: SshTunnelConfig;
	
	    static createFrom(source: any = {}) {
	        return new ConnectionConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.connectionString = source["connectionString"];
	        this.sshTunnel = this.convertValues(source["sshTunnel"], SshTunnelConfig);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class ZkStat {
	    czxid: string;
	    mzxid: string;
	    pzxid: string;
	    ctime: number;
	    mtime: number;
	    version: number;
	    cversion: number;
	    aversion: number;
	    ephemeralOwner: string;
	    dataLength: number;
	    numChildren: number;
	
	    static createFrom(source: any = {}) {
	        return new ZkStat(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.czxid = source["czxid"];
	        this.mzxid = source["mzxid"];
	        this.pzxid = source["pzxid"];
	        this.ctime = source["ctime"];
	        this.mtime = source["mtime"];
	        this.version = source["version"];
	        this.cversion = source["cversion"];
	        this.aversion = source["aversion"];
	        this.ephemeralOwner = source["ephemeralOwner"];
	        this.dataLength = source["dataLength"];
	        this.numChildren = source["numChildren"];
	    }
	}
	export class ZkNode {
	    path: string;
	    data: string;
	    stat: ZkStat;
	
	    static createFrom(source: any = {}) {
	        return new ZkNode(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.data = source["data"];
	        this.stat = this.convertValues(source["stat"], ZkStat);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

