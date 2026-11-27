import { DataSourceProvider } from './providers/DataSourceProvider'
import { HistoryProvider } from './providers/HistoryProvider'
import { LedgerProvider } from './providers/LedgerProvider'
import { ResourcesProvider } from './providers/ResourcesProvider'
import { RunProvider } from './providers/RunProvider'
import { ThemeProvider } from './providers/ThemeProvider'
import { ToastProvider } from './providers/ToastProvider'
import { Workspace } from './Workspace'

export function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <DataSourceProvider>
          <ResourcesProvider>
            <HistoryProvider>
              <LedgerProvider>
                <RunProvider>
                  <Workspace />
                </RunProvider>
              </LedgerProvider>
            </HistoryProvider>
          </ResourcesProvider>
        </DataSourceProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
