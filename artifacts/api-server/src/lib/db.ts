export function connectDatabase() {
  return {
    query: async (sql: string) => {
      throw new Error('DB layer is not implemented in this environment');
    },
  };
}
