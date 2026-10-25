import { lazy, Suspense, type CSSProperties, type ReactNode } from 'react'
import { Route, Routes, useParams } from 'react-router-dom'
import { NavigationSidebar, useNavigationLayout } from '@mado/design-system/react'
import HomePage from './pages/HomePage'
import StoragePage from './pages/StoragePage'
import StorageLanding from './pages/StorageLanding'
import SettingsPage from './pages/SettingsPage'
import NotFoundPage from './pages/NotFoundPage'
import { PlayerDeckProvider, usePlayerDeck } from './lib/playerDeck'
import { PinnedPreviewsProvider, usePinnedPreviews } from './lib/pinnedPreviews'
import { BottomDock } from './components/BottomDock'
import { NavigationLinkList } from './components/shell/NavigationLinkList'
import { TopBar } from './components/shell/TopBar'
import './App.css'
import { useLocale } from './i18n/useLocale'
import { translate } from './i18n/translate'

// NoteEditPage は Monaco エディタを抱える重量級ページ (~1MB)。
// ホーム閲覧だけのユーザに Monaco をロードさせないよう、別チャンクに切り出す。
const NoteEditPage = lazy(() => import('./pages/NoteEditPage'))
const LineagePage = lazy(() => import('./pages/LineagePage'))
const LineageRegisterPage = lazy(() => import('./pages/LineageRegisterPage'))

// connectionId が変わったときに StoragePage を再マウントしてインメモリ状態をすべてリセットする。
function StoragePageWithKey() {
  const { connectionId } = useParams<{ connectionId: string }>()
  return <StoragePage key={connectionId} connectionId={connectionId!} />
}

// BottomDock (同期プレイヤー + ピン留め) は画面下部に fixed でドックされるため、
// デッキにトラックがある / ピンがある間は本文の下端がドックに隠れないよう下の余白を
// 広げる。usePlayerDeck()/usePinnedPreviews() は各 Provider の内側でしか使えない
// ので、Provider に包まれるこの小さなラッパーで読む。
function MainContent({ children }: { children: ReactNode }) {
  const { tracks } = usePlayerDeck()
  const { pins } = usePinnedPreviews()
  const docked = tracks.length > 0 || pins.length > 0
  return (
    <main id="content" className="page" data-docked={docked ? 'true' : undefined}>
      {children}
    </main>
  )
}

/**
 * 画面の枠 (@mado/design-system の shell.css と React の部品): 上部バー、左のサイドバー
 * (1200px 以上は名前つき、900px 以上はアイコンだけ、それ未満は上部バーのメニューボタンから開く
 * ドロワー)、その右に画面。サイドバーの幅と畳んだかどうかは mado.navigation.* に保存する。
 */
export default function App() {
  useLocale()
  const navigation = useNavigationLayout({ storageKeyPrefix: 'mado.navigation' })
  return (
    <PlayerDeckProvider>
      <PinnedPreviewsProvider>
        <div
          className="app-shell"
          data-navigation={navigation.mode}
          style={{ '--navigation-width': `${navigation.width}px` } as CSSProperties}
        >
          <TopBar navigation={navigation} />
          <div className="app-body">
            {navigation.mode !== 'drawer' && (
              <NavigationSidebar
                layout={navigation}
                labels={{
                  sidebar: translate('navigationSidebar.label'),
                  expand: translate('navigationSidebar.expandSidebar'),
                  collapse: translate('navigationSidebar.showSidebarIconsOnly'),
                  width: translate('navigationResizeHandle.sidebarWidth'),
                }}
                renderLinks={({ showsTitles }) => <NavigationLinkList showsTitles={showsTitles} />}
              />
            )}
            <div className="app-content">
              <MainContent>
                <Suspense fallback={<p className="state-message">{translate('common.loading')}</p>}>
                  <Routes>
                    <Route path="/"                  element={<HomePage />} />
                    <Route path="/edit-note"         element={<NoteEditPage />} />
                    <Route path="/settings/*"        element={<SettingsPage />} />
                    <Route path="/storage"           element={<StorageLanding />} />
                    <Route path="/storage/:connectionId/*" element={<StoragePageWithKey />} />
                    <Route path="/lineage"            element={<LineagePage />} />
                    <Route path="/lineage/register"   element={<LineageRegisterPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </Suspense>
              </MainContent>
            </div>
          </div>
          <BottomDock />
        </div>
      </PinnedPreviewsProvider>
    </PlayerDeckProvider>
  )
}
