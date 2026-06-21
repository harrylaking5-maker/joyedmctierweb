import { useQuery } from '@tanstack/react-query';

let baseUrl = '';
export function setBaseUrl(url: string) {
  baseUrl = url;
}

export const getGetLeaderboardQueryKey = () => ['leaderboard'];
export const getGetOverviewLeaderboardQueryKey = () => ['overview-leaderboard'];
export const getGetPlayerQueryKey = (username: string) => ['player', username];

export function useGetLeaderboard() {
  return useQuery({
    queryKey: getGetLeaderboardQueryKey(),
    queryFn: async () => {
      const res = await fetch(`${baseUrl}/api/leaderboard`);
      return (await res.json()) as any;
    },
  });
}

export function useGetOverviewLeaderboard() {
  return useQuery({
    queryKey: getGetOverviewLeaderboardQueryKey(),
    queryFn: async () => {
      const res = await fetch(`${baseUrl}/api/overview`);
      return (await res.json()) as any;
    },
  });
}

export function useGetPlayer(username: string) {
  return useQuery({
    queryKey: getGetPlayerQueryKey(username),
    queryFn: async () => {
      const res = await fetch(`${baseUrl}/api/player/${username}`);
      return (await res.json()) as any;
    },
    enabled: !!username,
  });
}
