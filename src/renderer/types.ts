export interface ZkNode {
  path: string;
  data: string;
  stat: {
    czxid: string;
    mzxid: string;
    ctime: string;
    mtime: string;
    version: number;
    cversion: number;
    aversion: number;
    ephemeralOwner: string;
    dataLength: number;
    numChildren: number;
    pzxid: string;
  };
}

export interface TreeNode {
  path: string;
  name: string;
  hasChildren: boolean;
  isExpanded: boolean;
  isLoading: boolean;
  children: TreeNode[];
}

export interface ApiResult<T = void> {
  success: boolean;
  error?: string;
  node?: ZkNode;
  children?: string[];
  path?: string;
}

declare global {
  interface Window {
    zkApi: {
      connect: (connectionString: string) => Promise<ApiResult>;
      disconnect: () => Promise<ApiResult>;
      getChildren: (nodePath: string) => Promise<ApiResult<string[]>>;
      getNode: (nodePath: string) => Promise<ApiResult<ZkNode>>;
      createNode: (nodePath: string, data: string, ephemeral: boolean, sequential: boolean) => Promise<ApiResult>;
      setNodeData: (nodePath: string, data: string) => Promise<ApiResult>;
      deleteNode: (nodePath: string) => Promise<ApiResult>;
      showMessage: (options: { type?: string; title?: string; message: string; buttons?: string[] }) => Promise<{ response: number }>;
      onConnected: (callback: () => void) => () => void;
      onDisconnected: (callback: () => void) => () => void;
    };
  }
}
