// No-op mock for database connect/disconnect
export async function connectDatabase(_uri?: string): Promise<void> {
  // no-op
}

export async function disconnectDatabase(): Promise<void> {
  // no-op
}
