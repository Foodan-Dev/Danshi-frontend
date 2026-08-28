import React, { createContext, type PropsWithChildren, useContext } from 'react';

const ExploreTabRefreshRequestContext = createContext(0);

type ExploreTabRefreshRequestProviderProps = PropsWithChildren<{
  requestId: number;
}>;

export function ExploreTabRefreshRequestProvider({
  requestId,
  children,
}: ExploreTabRefreshRequestProviderProps) {
  return (
    <ExploreTabRefreshRequestContext.Provider value={requestId}>
      {children}
    </ExploreTabRefreshRequestContext.Provider>
  );
}

export function useExploreTabRefreshRequest() {
  return useContext(ExploreTabRefreshRequestContext);
}
