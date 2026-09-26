const BOARD_PATH_PREFIX = '/board/'

/**
 * Builds the link back to the board settings page, carrying over the current board's
 * type and query parameters so the settings page can pre-fill them.
 */
export default function getEditBoardUrl(pathname: string, search: string): string {
  const params = new URLSearchParams(search)

  if (pathname.startsWith(BOARD_PATH_PREFIX)) {
    const type = pathname.slice(BOARD_PATH_PREFIX.length).replace(/\/$/, '')

    if (type) params.set('type', type)
  }

  const query = params.toString()

  return query ? `/board?${query}` : '/board'
}
