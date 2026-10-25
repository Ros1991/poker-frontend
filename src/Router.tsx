import { Routes, Route, Navigate } from 'react-router-dom'
import { ROUTES } from './constants/routes'
import { ProtectedRoute } from './components/common/ProtectedRoute'
import { RootGate } from './components/common/RootGate'
import { AppLayout } from './components/layout/AppLayout'

// Auth
import { LoginPage } from './pages/auth/LoginPage'
import { RegisterPage } from './pages/auth/RegisterPage'
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage'
import { ConfirmEmailPage } from './pages/auth/ConfirmEmailPage'

// TV & Dealer (standalone layouts)
import { TvScreen, TvDirectPairPage } from './pages/tv-display/TvScreen'
import { PairDisplayPage } from './pages/tv-display/PairDisplayPage'
import { DealerTerminalRoute } from './pages/dealer/DealerTerminalRoute'
import { DealerAccessPage } from './pages/dealer/DealerAccessPage'

// Ranking público (sem login)
import { PublicRankingPage } from './pages/public-ranking/PublicRankingPage'
import { PublicPlayerPage } from './pages/public-ranking/PublicPlayerPage'

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

// Plano da conta
import { MyPlanPage } from './pages/plan/MyPlanPage'

// Meu perfil
import { MyProfilePage } from './pages/profile/MyProfilePage'

// Boas-vindas do primeiro acesso
import { WelcomePage } from './pages/onboarding/WelcomePage'

// Users (Admin)
import { UserListPage } from './pages/users/UserListPage'
import { UserFormPage } from './pages/users/UserFormPage'

export function Router() {
  return (
    <Routes>
      {/* Public routes */}
      {/* "/": painel se logado; senão a tela da TV com QR e botão Entrar */}
      <Route path={ROUTES.HOME} element={<RootGate />} />
      <Route path={ROUTES.LOGIN} element={<LoginPage />} />
      <Route path={ROUTES.REGISTER} element={<RegisterPage />} />
      <Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPasswordPage />} />
      <Route path={ROUTES.RESET_PASSWORD} element={<ResetPasswordPage />} />
      <Route path={ROUTES.CONFIRM_EMAIL} element={<ConfirmEmailPage />} />
      <Route path={ROUTES.TV} element={<TvScreen />} />
      <Route path={ROUTES.TV_DISPLAY} element={<TvDirectPairPage />} />
      <Route path={ROUTES.DEALER_ACCESS} element={<DealerAccessPage />} />
      <Route path={ROUTES.PUBLIC_RANKING} element={<PublicRankingPage />} />
      <Route
        path={ROUTES.PUBLIC_RANKING_PLAYER}
        element={<PublicPlayerPage />}
      />

      {/* Protected routes with sidebar layout */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
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

        {/* Meu plano (SPEC-20261023-1205) */}
        <Route path={ROUTES.MY_PLAN} element={<MyPlanPage />} />

        {/* Meu perfil (SPEC-20261023-1211) */}
        <Route path={ROUTES.MY_PROFILE} element={<MyProfilePage />} />

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

      {/* Boas-vindas do primeiro acesso (SPEC-20261023-1212): logado, sem sidebar; depois volta para a origem */}
      <Route
        path={ROUTES.WELCOME}
        element={
          <ProtectedRoute skipOnboarding>
            <WelcomePage />
          </ProtectedRoute>
        }
      />

      {/* Celular lendo o QR da TV: login e volta para escolher o torneio */}
      <Route
        path={ROUTES.PAIR_DISPLAY}
        element={
          <ProtectedRoute>
            <PairDisplayPage />
          </ProtectedRoute>
        }
      />

      {/* Dealer terminal - QR do dealer (sem login) ou usuário logado; sem sidebar */}
      <Route path={ROUTES.DEALER_TERMINAL} element={<DealerTerminalRoute />} />

      {/* Catch all: "/" decide (painel, terminal do dealer ou tela da TV) */}
      <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
    </Routes>
  )
}
