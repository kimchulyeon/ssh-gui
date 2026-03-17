import { Client } from "ssh2";
import fs from "fs";
import os from "os";

export interface SSHConfig {
  host: string;
  port: number;
  username: string;
  authType: "key" | "password";
  privateKeyPath?: string;
  password?: string;
}

export class SSHConnection {
  private client: Client;
  private connected = false;

  constructor() {
    this.client = new Client();
  }

  async connect(config: SSHConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      const connectionConfig: any = {
        host: config.host,
        port: config.port,
        username: config.username,
        readyTimeout: 30000,
        keepaliveInterval: 10000,
      };

      if (config.authType === "key") {
        const keyPath = (config.privateKeyPath || "~/.ssh/id_ed25519").replace(
          "~",
          os.homedir(),
        );
        try {
          connectionConfig.privateKey = fs.readFileSync(keyPath);
        } catch {
          return reject(new Error(`SSH key not found: ${keyPath}`));
        }
      } else {
        connectionConfig.password = config.password;
      }

      this.client.on("ready", () => {
        this.connected = true;
        resolve();
      });

      this.client.on("error", (err) => {
        this.connected = false;
        reject(err);
      });

      this.client.on("close", () => {
        this.connected = false;
      });

      this.client.connect(connectionConfig);
    });
  }

  disconnect() {
    this.connected = false;
    this.client.end();
  }

  isConnected(): boolean {
    return this.connected;
  }

  getClient(): Client {
    return this.client;
  }

  async exec(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.client.exec(command, (err, stream) => {
        if (err) return reject(err);
        let output = "";
        let errorOutput = "";
        stream.on("data", (data: Buffer) => {
          output += data.toString();
        });
        stream.stderr.on("data", (data: Buffer) => {
          errorOutput += data.toString();
        });
        stream.on("close", () => {
          resolve(output || errorOutput);
        });
      });
    });
  }
}
