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

// Termos e privacidade (sem login; carregados sob demanda — SPEC-20261023-1207)
import { TermsRoute, PrivacyRoute } from './pages/legal/LegalRoutes'

// Manual de uso público (sem login; sob demanda — SPEC-20261026-1910). Visita direta: o boot.tsx abre o manual sozinho
import { ManualRoute } from './pages/manual/ManualRoute'

// Início da conta (SPEC-20261029-1724)
import { InicioPage } from './pages/inicio/InicioPage'

// Home game: casca + seções por rota (SPEC-20261029-1724)
import {
  HomeGameDetailPage,
  HomeGameIndexRedirect,
  LegacySectionRedirect,
} from './pages/home-games/HomeGameDetailPage'
import { TournamentsSection } from './pages/home-games/sections/TournamentsSection'
import { RankingsSection } from './pages/home-games/sections/RankingsSection'
import { StructuresSection } from './pages/home-games/sections/StructuresSection'
import { PlayersSection } from './pages/home-games/sections/PlayersSection'
import { MembersSection } from './pages/home-games/sections/MembersSection'
import { HomeGameSettingsPage } from './pages/home-games/HomeGameSettingsPage'
import { PlayersRedirect } from './pages/home-games/sections/PlayersRedirect'

// Tournaments
import { TournamentFormPage } from './pages/tournaments/TournamentFormPage'
import { TournamentDashboardPage } from './pages/tournaments/TournamentDashboardPage'

// Players
import { PlayerFormPage } from './pages/players/PlayerFormPage'
import { PlayerDetailPage } from './pages/players/PlayerDetailPage'

// Rankings
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
import { UserDetailPage } from './pages/users/UserDetailPage'
import { UserFormPage } from './pages/users/UserFormPage'

// Administração → Inteligência artificial (SPEC-20261027-1312)
import { AiSettingsPage } from './pages/ai/AiSettingsPage'

export function Router() {
  return (
    <Routes>
      {/* Public routes */}
      {/* "/": logado → Início (SPEC-20261029-1724); sem login, terminal se dealer, telão se TV pareada e senão a landing */}
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
      {/* Termos de uso e política de privacidade (SPEC-20261023-1207) */}
      <Route path={ROUTES.TERMS} element={<TermsRoute />} />
      <Route path={ROUTES.PRIVACY} element={<PrivacyRoute />} />
      {/* Manual de uso (SPEC-20261026-1910): índice e um módulo por página */}
      <Route path={ROUTES.MANUAL} element={<ManualRoute />} />
      <Route path={ROUTES.MANUAL_MODULE} element={<ManualRoute />} />

      {/* Protected routes with sidebar layout */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* Início da conta (SPEC-20261029-1724): a porta de entrada de quem está logado */}
        <Route path={ROUTES.INICIO} element={<InicioPage />} />
        {/* A lista de home games saiu (o Início e o seletor do cabeçalho bastam) */}
        <Route path="/home-games" element={<Navigate to={ROUTES.INICIO} replace />} />
        {/* Criar home game (só a Liga): o Início com o modal de criar */}
        <Route path={ROUTES.HOME_GAME_NEW} element={<InicioPage createHomeGame />} />

        {/* Home game: casca + uma rota por seção (SPEC-20261029-1724); /home-games/:id e o ?tab= antigo redirecionam */}
        <Route path={ROUTES.HOME_GAME_DETAIL} element={<HomeGameDetailPage />}>
          <Route index element={<HomeGameIndexRedirect />} />
          <Route path="torneios" element={<TournamentsSection />} />
          <Route path="rankings" element={<RankingsSection />} />
          <Route path="estruturas" element={<StructuresSection />} />
          <Route path="jogadores" element={<PlayersSection />} />
          <Route path="membros" element={<MembersSection />} />
          <Route path="configuracoes" element={<HomeGameSettingsPage />} />
        </Route>
        {/* Endereços antigos: editar home game → Configurações; lista de torneios → Torneios; jogadores → Jogadores */}
        <Route path={ROUTES.HOME_GAME_EDIT} element={<LegacySectionRedirect section="configuracoes" />} />
        <Route path={ROUTES.TOURNAMENTS} element={<LegacySectionRedirect section="torneios" />} />
        <Route path={ROUTES.PLAYERS} element={<PlayersRedirect />} />

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
        <Route path={ROUTES.PLAYER_NEW} element={<PlayerFormPage />} />
        <Route path={ROUTES.PLAYER_DETAIL} element={<PlayerDetailPage />} />
        <Route path={ROUTES.PLAYER_EDIT} element={<PlayerFormPage />} />

        {/* Rankings */}
        <Route path={ROUTES.RANKING_NEW} element={<RankingFormPage />} />
        <Route path={ROUTES.RANKING_DETAIL} element={<RankingDetailPage />} />
        <Route path={ROUTES.RANKING_EDIT} element={<RankingFormPage />} />

        {/* Meu plano (SPEC-20261023-1205) */}
        <Route path={ROUTES.MY_PLAN} element={<MyPlanPage />} />

        {/* Meu perfil (SPEC-20261023-1211) */}
        <Route path={ROUTES.MY_PROFILE} element={<MyProfilePage />} />

        {/* Administração (SPEC-20261023-1206, só Admin): lista, ficha e editar dados; sem criar usuário (D14) */}
        <Route
          path={ROUTES.USERS}
          element={
            <ProtectedRoute roles={['Admin']}>
              <UserListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.USER_DETAIL}
          element={
            <ProtectedRoute roles={['Admin']}>
              <UserDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.USER_EDIT}
          element={
            <ProtectedRoute roles={['Admin']}>
              <UserFormPage />
            </ProtectedRoute>
          }
        />
        {/* Administração → Inteligência artificial (SPEC-20261027-1312, só Admin; a API devolve 403 aos demais) */}
        <Route
          path={ROUTES.ADMIN_AI}
          element={
            <ProtectedRoute roles={['Admin']}>
              <AiSettingsPage />
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

      {/* Catch all: "/" decide (Início de quem está logado, landing, terminal do dealer ou tela da TV) */}
      <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
    </Routes>
  )
}
