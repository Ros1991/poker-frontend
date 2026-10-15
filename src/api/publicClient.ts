import axios from 'axios'

// Cliente das páginas públicas (sem login). Não usa o apiClient porque aquele
// anexa o token e, em 401, tenta refresh e limpa a sessão — um admin logado
// que abrisse o link público poderia perder a sessão por causa disso.
const publicClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  timeout: 20000,
})

export default publicClient
