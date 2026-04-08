import { Routes, Route, Navigate } from 'react-router-dom'
import { ROUTES } from './constants/routes'
import { ProtectedRoute } from './components/common/ProtectedRoute'
import { AppLayout } from './components/layout/AppLayout'

// Auth
import { LoginPage } from './pages/auth/LoginPage'
import { RegisterPage } from './pages/auth/RegisterPage'

// TV & Dealer (standalone layouts)
import { TvDisplayPage } from './pages/tv-display/TvDisplayPage'
import { DealerTerminalPage } from './pages/dealer/DealerTerminalPage'

// Home Games
import { HomeGameListPage } from './pages/home-games/HomeGameListPage'
import { HomeGameFormPage } from './pages/home-games/HomeGameFormPage'
import { HomeGameDetailPage } from './pages/home-games/HomeGameDetailPage'

// Tournaments
import { TournamentListPage } from './pages/tournaments/TournamentListPage'
import { TournamentFormPage } from './pages/tournaments/TournamentFormPage'
import { TournamentDashboardPage } from './pages/tournaments/TournamentDashboardPage'

// Players
import { PlayerListPage } from './pages/players/PlayerListPage'
import { PlayerFormPage } from './pages/players/PlayerFormPage'
import { PlayerDetailPage } from './pages/players/PlayerDetailPage'

// Rankings
import { RankingListPage } from './pages/rankings/RankingListPage'
import { RankingFormPage } from './pages/rankings/RankingFormPage'
import { RankingDetailPage } from './pages/rankings/RankingDetailPage'

// Blind Structures
import { BlindStructureFormPage } from './pages/blinds/BlindStructureFormPage'

// Users (Admin)
import { UserListPage } from './pages/users/UserListPage'
import { UserFormPage } from './pages/users/UserFormPage'

export function Router() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path={ROUTES.LOGIN} element={<LoginPage />} />
      <Route path={ROUTES.REGISTER} element={<RegisterPage />} />
      <Route path={ROUTES.TV_DISPLAY} element={<TvDisplayPage />} />

      {/* Protected routes with sidebar layout */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* Home → redirect to home games */}
        <Route
          path={ROUTES.HOME}
          element={<Navigate to={ROUTES.HOME_GAMES} replace />}
        />

        {/* Home Games */}
        <Route path={ROUTES.HOME_GAMES} element={<HomeGameListPage />} />
        <Route path={ROUTES.HOME_GAME_NEW} element={<HomeGameFormPage />} />
        <Route
          path={ROUTES.HOME_GAME_DETAIL}
          element={<HomeGameDetailPage />}
        />
        <Route path={ROUTES.HOME_GAME_EDIT} element={<HomeGameFormPage />} />

        {/* Blind Structures */}
        <Route
          path={ROUTES.BLIND_STRUCTURE_NEW}
          element={<BlindStructureFormPage />}
        />
        <Route
          path={ROUTES.BLIND_STRUCTURE_EDIT}
          element={<BlindStructureFormPage />}
        />

        {/* Tournaments */}
        <Route path={ROUTES.TOURNAMENTS} element={<TournamentListPage />} />
        <Route path={ROUTES.TOURNAMENT_NEW} element={<TournamentFormPage />} />
        <Route
          path={ROUTES.TOURNAMENT_EDIT}
          element={<TournamentFormPage />}
        />
        <Route
          path={ROUTES.TOURNAMENT_DASHBOARD}
          element={<TournamentDashboardPage />}
        />

        {/* Players */}
        <Route path={ROUTES.PLAYERS} element={<PlayerListPage />} />
        <Route path={ROUTES.PLAYER_NEW} element={<PlayerFormPage />} />
        <Route path={ROUTES.PLAYER_DETAIL} element={<PlayerDetailPage />} />
        <Route path={ROUTES.PLAYER_EDIT} element={<PlayerFormPage />} />

        {/* Rankings */}
        <Route
          path={ROUTES.RANKINGS_BY_HOME_GAME}
          element={<RankingListPage />}
        />
        <Route path={ROUTES.RANKING_NEW} element={<RankingFormPage />} />
        <Route path={ROUTES.RANKING_DETAIL} element={<RankingDetailPage />} />
        <Route path={ROUTES.RANKING_EDIT} element={<RankingFormPage />} />

        {/* Users (Admin only) */}
        <Route
          path={ROUTES.USERS}
          element={
            <ProtectedRoute roles={['Admin']}>
              <UserListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.USER_NEW}
          element={
            <ProtectedRoute roles={['Admin']}>
              <UserFormPage />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Dealer terminal - protected but no sidebar layout */}
      <Route
        path={ROUTES.DEALER_TERMINAL}
        element={
          <ProtectedRoute>
            <DealerTerminalPage />
          </ProtectedRoute>
        }
      />

      {/* Catch all */}
      <Route
        path="*"
        element={<Navigate to={ROUTES.HOME_GAMES} replace />}
      />
    </Routes>
  )
}
