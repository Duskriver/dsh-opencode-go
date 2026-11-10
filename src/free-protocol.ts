/** Private stdin/stdout protocol; request credentials never enter argv or files. */
export interface FreeHttpRequest {
  url: string
  method: string
  headers: [string, string][]
  body?: string
  bodyLength?: number
  redirect: RequestRedirect
  proxy?: string
}

export interface FreeHttpResponse {
  status: number
  statusText: string
  headers: [string, string][]
  url: string
  redirected: boolean
}
