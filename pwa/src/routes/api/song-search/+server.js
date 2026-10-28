import { json } from '@sveltejs/kit'

function clean(value) {
  return typeof value === 'string'
    ? value.trim()
    : ''
}

function numberOrNull(value) {
  const number = Number(value)

  return Number.isFinite(number) && number > 0
    ? number
    : null
}

function durationSeconds(milliseconds) {
  const value = numberOrNull(milliseconds)

  return value
    ? Math.round(value / 1000)
    : null
}

function normalize(value) {
  return clean(value).toLowerCase()
}

function sortResults(results, title, artist) {
  const wantedTitle = normalize(title)
  const wantedArtist = normalize(artist)

  return [...results].sort((a, b) => {
    const score = (item) => {
      let value = 0

      const itemTitle =
        normalize(item.title)

      const itemArtist =
        normalize(item.artist)

      if (
        wantedTitle &&
        itemTitle === wantedTitle
      ) {
        value += 100
      } else if (
        wantedTitle &&
        itemTitle.includes(wantedTitle)
      ) {
        value += 50
      }

      if (
        wantedArtist &&
        itemArtist === wantedArtist
      ) {
        value += 100
      } else if (
        wantedArtist &&
        itemArtist.includes(wantedArtist)
      ) {
        value += 50
      }

      return value
    }

    return score(b) - score(a)
  })
}

async function searchItunes(title, artist) {
  const searchText = [
    clean(title),
    clean(artist)
  ]
    .filter(Boolean)
    .join(' ')

  const params = new URLSearchParams({
    term: searchText,
    country: 'US',
    media: 'music',
    entity: 'song',
    attribute: 'songTerm',
    limit: '25',
    explicit: 'Yes'
  })

  const response = await fetch(
    `https://itunes.apple.com/search?${params}`,
    {
      headers: {
        Accept: 'application/json'
      }
    }
  )

  if (!response.ok) {
    throw new Error(
      `Song search failed (${response.status})`
    )
  }

  const payload = await response.json()

  const results = (payload.results ?? [])
    .filter((track) =>
      track.wrapperType === 'track' &&
      track.kind === 'song'
    )
    .map((track) => ({
      id: String(track.trackId),
      title:
        clean(track.trackName),
      artist:
        clean(track.artistName),
      release:
        clean(track.collectionName),
      releaseDate:
        clean(track.releaseDate)
          .slice(0, 10),
      durationSec:
        durationSeconds(
          track.trackTimeMillis
        ),
      genre:
        clean(track.primaryGenreName),
      trackNumber:
        numberOrNull(track.trackNumber),
      discNumber:
        numberOrNull(track.discNumber),
      artworkUrl:
        clean(track.artworkUrl100),
      sourceUrl:
        clean(track.trackViewUrl),
      source:
        'iTunes Search API'
    }))

  return sortResults(
    results,
    title,
    artist
  )
}

async function enrichFromAudioDb(
  title,
  artist
) {
  if (!title || !artist) {
    return {}
  }

  try {
    const params = new URLSearchParams({
      s: artist,
      t: title
    })

    const response = await fetch(
      `https://www.theaudiodb.com/api/v1/json/123/searchtrack.php?${params}`,
      {
        headers: {
          Accept: 'application/json'
        }
      }
    )

    if (!response.ok) {
      return {}
    }

    const payload =
      await response.json()

    const tracks =
      payload.track ?? []

    const exactTrack =
      tracks.find((track) =>
        normalize(track.strTrack) ===
          normalize(title) &&
        normalize(track.strArtist) ===
          normalize(artist)
      ) ?? tracks[0]

    if (!exactTrack) {
      return {}
    }

    const durationMs =
      numberOrNull(
        exactTrack.intDuration
      )

    const bpm =
      numberOrNull(
        exactTrack.intBPM ??
        exactTrack.intTempo ??
        exactTrack.strBPM
      )

    return {
      genre:
        clean(exactTrack.strGenre),

      mood:
        clean(exactTrack.strMood),

      description:
        clean(
          exactTrack.strDescriptionEN
        ),

      durationSec:
        durationMs
          ? Math.round(
              durationMs / 1000
            )
          : null,

      bpm,

      key:
        clean(
          exactTrack.strKey ??
          exactTrack.strMusicKey
        ),

      timeSignature:
        clean(
          exactTrack.strTimeSignature
        ),

      source:
        'TheAudioDB'
    }
  } catch {
    return {}
  }
}

export async function GET({ url }) {
  const title =
    clean(
      url.searchParams.get('title')
    )

  const artist =
    clean(
      url.searchParams.get('artist')
    )

  if (!title && !artist) {
    return json(
      {
        results: [],
        error:
          'Enter a song title, artist, or both.'
      },
      {
        status: 400
      }
    )
  }

  try {
    const results =
      await searchItunes(
        title,
        artist
      )

    return json({
      results,
      source: 'iTunes Search API'
    })
  } catch (error) {
    console.error(
      'Song search failed:',
      error
    )

    return json({
      results: [],
      error:
        error?.message ??
        'Song search is temporarily unavailable.'
    })
  }
}

export async function POST({
  request
}) {
  try {
    const body =
      await request.json()

    const title =
      clean(body?.title)

    const artist =
      clean(body?.artist)

    if (!title || !artist) {
      return json({
        enrichment: {},
        warning:
          'Title and artist are required for metadata enrichment.'
      })
    }

    const enrichment =
      await enrichFromAudioDb(
        title,
        artist
      )

    return json({
      enrichment
    })
  } catch (error) {
    console.error(
      'Metadata enrichment failed:',
      error
    )

    /*
     * Enrichment is optional. Return an
     * empty object instead of blocking the
     * user with a 502 response.
     */
    return json({
      enrichment: {},
      warning:
        'Additional metadata was unavailable.'
    })
  }
}