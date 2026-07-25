import env from '@/config/env.config';
import { ApiError } from '@/utils/ApiError';

const CYANITE_GRAPHQL_URL = 'https://api.cyanite.ai/graphql';

interface GraphQlResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

export interface CyaniteTrackMatch {
  id: string;
  title: string;
  externalId?: string | null;
  score?: number;
}

export interface CyaniteUploadRequest {
  id: string;
  uploadUrl: string;
}

export interface CyaniteAnalysisResult {
  advancedGenreTags?: string[] | null;
  advancedInstrumentTags?: string[] | null;
  advancedInstrumentTagsExtended?: string[] | null;
  advancedSubgenreTags?: string[] | null;
  arousal?: number | null;
  bpmPrediction?: { value: number; confidence?: number | null } | null;
  characterTags?: string[] | null;
  classicalEpochTags?: string[] | null;
  emotionalDynamics?: string | null;
  emotionalProfile?: string | null;
  energyDynamics?: string | null;
  energyLevel?: string | null;
  freeGenreTags?: string | null;
  genreTags?: string[] | null;
  instrumentTags?: string[] | null;
  keyPrediction?: { value: string; confidence?: number | null } | null;
  moodAdvancedTags?: string[] | null;
  moodTags?: string[] | null;
  movementTags?: string[] | null;
  musicalEraTag?: string | null;
  subgenreTags?: string[] | null;
  timeSignature?: string | null;
  transformerCaption?: string | null;
  valence?: number | null;
  voicePresenceProfile?: string | null;
  voiceTags?: string[] | null;
  voiceoverDegree?: number | null;
  voiceoverExists?: boolean | null;
}

export interface CyaniteLibraryTrackAnalysis {
  id: string;
  title?: string | null;
  externalId?: string | null;
  status: 'not_started' | 'pending' | 'finished' | 'failed';
  result?: CyaniteAnalysisResult;
  error?: string;
}

const ensureApiKey = (): string => {
  if (!env.CYANITE_API_KEY) {
    throw new ApiError(503, 'AI search is not configured yet');
  }
  return env.CYANITE_API_KEY;
};

export const cyaniteGraphql = async <T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> => {
  const response = await fetch(CYANITE_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ensureApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  const body = (await response.json()) as GraphQlResponse<T>;
  if (!response.ok || body.errors?.length) {
    throw new ApiError(
      502,
      body.errors?.map((error) => error.message).join(' | ') ||
        'Cyanite request failed',
    );
  }

  if (!body.data) {
    throw new ApiError(502, 'Cyanite returned an empty response');
  }

  return body.data;
};

export const advancedTextSearch = async (
  text: string,
  limit: number,
): Promise<CyaniteTrackMatch[]> => {
  const query = `
    query AdvancedTextSearch($text: String!, $first: Int!) {
      advancedSearch(text: $text, target: { library: {} }, first: $first) {
        __typename
        ... on AdvancedSearchError {
          code
          message
        }
        ... on AdvancedSearchConnection {
          edges {
            node {
              score
              track {
                __typename
                ... on AdvancedSearchNodeLibraryTrack {
                  id
                  title
                  externalId
                }
              }
            }
          }
        }
      }
    }
  `;

  const data = await cyaniteGraphql<{
    advancedSearch:
      | { __typename: 'AdvancedSearchError'; message: string }
      | {
          __typename: 'AdvancedSearchConnection';
          edges: Array<{
            node: {
              score: number;
              track: {
                __typename: string;
                id: string;
                title: string;
                externalId?: string | null;
              };
            };
          }>;
        };
  }>(query, { text, first: limit });

  if (data.advancedSearch.__typename === 'AdvancedSearchError') {
    throw new ApiError(502, data.advancedSearch.message);
  }

  return data.advancedSearch.edges
    .map((edge) => ({
      id: edge.node.track.id,
      title: edge.node.track.title,
      externalId: edge.node.track.externalId,
      score: edge.node.score,
    }))
    .filter((track) => Boolean(track.id));
};

export const requestFileUpload = async (): Promise<CyaniteUploadRequest> => {
  const mutation = `
    mutation FileUploadRequest {
      fileUploadRequest {
        id
        uploadUrl
      }
    }
  `;

  const data = await cyaniteGraphql<{ fileUploadRequest: CyaniteUploadRequest }>(
    mutation,
    {},
  );

  return data.fileUploadRequest;
};

export const uploadAudioToCyanite = async (
  uploadUrl: string,
  audio: Buffer,
): Promise<void> => {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'audio/mpeg',
    },
    body: audio,
  });

  if (!response.ok) {
    throw new ApiError(502, 'Cyanite audio upload failed');
  }
};

export const createLibraryTrack = async ({
  uploadId,
  title,
  externalId,
}: {
  uploadId: string;
  title: string;
  externalId: string;
}): Promise<{ id: string; enqueueStatus: string }> => {
  const mutation = `
    mutation LibraryTrackCreate($input: LibraryTrackCreateInput!) {
      libraryTrackCreate(input: $input) {
        __typename
        ... on LibraryTrackCreateError {
          code
          message
        }
        ... on LibraryTrackCreateSuccess {
          createdLibraryTrack {
            id
          }
          enqueueResult {
            __typename
            ... on LibraryTrackEnqueueError {
              code
              message
            }
            ... on LibraryTrackEnqueueSuccess {
              enqueuedLibraryTrack {
                id
              }
            }
          }
        }
      }
    }
  `;

  const data = await cyaniteGraphql<{
    libraryTrackCreate:
      | { __typename: 'LibraryTrackCreateError'; message: string }
      | {
          __typename: 'LibraryTrackCreateSuccess';
          createdLibraryTrack: { id: string };
          enqueueResult:
            | { __typename: 'LibraryTrackEnqueueError'; message: string }
            | {
                __typename: 'LibraryTrackEnqueueSuccess';
                enqueuedLibraryTrack: { id: string };
              };
        };
  }>(mutation, { input: { uploadId, title, externalId } });

  if (data.libraryTrackCreate.__typename === 'LibraryTrackCreateError') {
    throw new ApiError(422, data.libraryTrackCreate.message);
  }

  const enqueueStatus = data.libraryTrackCreate.enqueueResult.__typename;
  if (enqueueStatus === 'LibraryTrackEnqueueError') {
    throw new ApiError(422, data.libraryTrackCreate.enqueueResult.message);
  }

  return {
    id: data.libraryTrackCreate.createdLibraryTrack.id,
    enqueueStatus,
  };
};

export const enqueueLibraryTrack = async (
  libraryTrackId: string,
): Promise<void> => {
  const mutation = `
    mutation LibraryTrackEnqueue($input: LibraryTrackEnqueueInput!) {
      libraryTrackEnqueue(input: $input) {
        __typename
        ... on LibraryTrackEnqueueError {
          code
          message
        }
        ... on LibraryTrackEnqueueSuccess {
          enqueuedLibraryTrack {
            id
          }
        }
      }
    }
  `;

  const data = await cyaniteGraphql<{
    libraryTrackEnqueue:
      | { __typename: 'LibraryTrackEnqueueError'; message: string }
      | {
          __typename: 'LibraryTrackEnqueueSuccess';
          enqueuedLibraryTrack: { id: string };
        };
  }>(mutation, { input: { libraryTrackId } });

  if (data.libraryTrackEnqueue.__typename === 'LibraryTrackEnqueueError') {
    throw new ApiError(422, data.libraryTrackEnqueue.message);
  }
};

export const getLibraryTrackAnalysis = async (
  libraryTrackId: string,
): Promise<CyaniteLibraryTrackAnalysis> => {
  const query = `
    query LibraryTrackAnalysis($id: ID!) {
      libraryTrack(id: $id) {
        __typename
        ... on Error {
          message
        }
        ... on LibraryTrack {
          id
          title
          externalId
          audioAnalysisV7 {
            __typename
            ... on AudioAnalysisV7NotStarted {
              __typename
            }
            ... on AudioAnalysisV7Enqueued {
              __typename
            }
            ... on AudioAnalysisV7Processing {
              __typename
            }
            ... on AudioAnalysisV7Failed {
              error {
                message
              }
            }
            ... on AudioAnalysisV7Finished {
              result {
                advancedGenreTags
                advancedInstrumentTags
                advancedInstrumentTagsExtended
                advancedSubgenreTags
                arousal
                bpmPrediction {
                  value
                  confidence
                }
                characterTags
                classicalEpochTags
                emotionalDynamics
                emotionalProfile
                energyDynamics
                energyLevel
                freeGenreTags
                genreTags
                instrumentTags
                keyPrediction {
                  value
                  confidence
                }
                moodAdvancedTags
                moodTags
                movementTags
                musicalEraTag
                subgenreTags
                timeSignature
                transformerCaption
                valence
                voicePresenceProfile
                voiceTags
                voiceoverDegree
                voiceoverExists
              }
            }
          }
        }
      }
    }
  `;

  const data = await cyaniteGraphql<{
    libraryTrack:
      | { __typename: 'Error'; message: string }
      | {
          __typename: 'LibraryTrack';
          id: string;
          title?: string | null;
          externalId?: string | null;
          audioAnalysisV7:
            | { __typename: 'AudioAnalysisV7NotStarted' }
            | { __typename: 'AudioAnalysisV7Enqueued' }
            | { __typename: 'AudioAnalysisV7Processing' }
            | { __typename: 'AudioAnalysisV7NotAuthorized' }
            | { __typename: 'AudioAnalysisV7Failed'; error: { message: string } }
            | {
                __typename: 'AudioAnalysisV7Finished';
                result: CyaniteAnalysisResult;
              };
        };
  }>(query, { id: libraryTrackId });

  if (data.libraryTrack.__typename === 'Error') {
    throw new ApiError(422, data.libraryTrack.message);
  }

  const analysis = data.libraryTrack.audioAnalysisV7;
  if (analysis.__typename === 'AudioAnalysisV7Finished') {
    return {
      id: data.libraryTrack.id,
      title: data.libraryTrack.title,
      externalId: data.libraryTrack.externalId,
      status: 'finished',
      result: analysis.result,
    };
  }

  if (analysis.__typename === 'AudioAnalysisV7Failed') {
    return {
      id: data.libraryTrack.id,
      title: data.libraryTrack.title,
      externalId: data.libraryTrack.externalId,
      status: 'failed',
      error: analysis.error.message,
    };
  }

  return {
    id: data.libraryTrack.id,
    title: data.libraryTrack.title,
    externalId: data.libraryTrack.externalId,
    status:
      analysis.__typename === 'AudioAnalysisV7NotStarted'
        ? 'not_started'
        : 'pending',
  };
};

export const enqueueSpotifyTrack = async (
  spotifyTrackId: string,
): Promise<string> => {
  const mutation = `
    mutation EnqueueSpotifyTrack($spotifyTrackId: ID!) {
      spotifyTrackEnqueue(input: { spotifyTrackId: $spotifyTrackId }) {
        __typename
        ... on SpotifyTrackEnqueueError {
          code
          message
        }
        ... on SpotifyTrackEnqueueSuccess {
          enqueuedSpotifyTrack {
            id
          }
        }
      }
    }
  `;

  const data = await cyaniteGraphql<{
    spotifyTrackEnqueue:
      | { __typename: 'SpotifyTrackEnqueueError'; message: string }
      | {
          __typename: 'SpotifyTrackEnqueueSuccess';
          enqueuedSpotifyTrack: { id: string };
        };
  }>(mutation, { spotifyTrackId });

  if (data.spotifyTrackEnqueue.__typename === 'SpotifyTrackEnqueueError') {
    throw new ApiError(422, data.spotifyTrackEnqueue.message);
  }

  return data.spotifyTrackEnqueue.enqueuedSpotifyTrack.id;
};

export const enqueueYouTubeTrack = async (
  videoUrl: string,
): Promise<string> => {
  const mutation = `
    mutation EnqueueYouTubeTrack($videoUrl: String!) {
      youTubeTrackEnqueue(input: { videoUrl: $videoUrl }) {
        __typename
        ... on YouTubeTrackEnqueueError {
          code
          message
        }
        ... on YouTubeTrackEnqueueSuccess {
          enqueuedLibraryTrack {
            id
          }
        }
      }
    }
  `;

  const data = await cyaniteGraphql<{
    youTubeTrackEnqueue:
      | { __typename: 'YouTubeTrackEnqueueError'; message: string }
      | {
          __typename: 'YouTubeTrackEnqueueSuccess';
          enqueuedLibraryTrack: { id: string };
        };
  }>(mutation, { videoUrl });

  if (data.youTubeTrackEnqueue.__typename === 'YouTubeTrackEnqueueError') {
    throw new ApiError(422, data.youTubeTrackEnqueue.message);
  }

  return data.youTubeTrackEnqueue.enqueuedLibraryTrack.id;
};

export const similarLibraryTracksFromSpotify = async (
  spotifyTrackId: string,
  limit: number,
): Promise<CyaniteTrackMatch[]> => {
  const query = `
    query SpotifySimilarTracks($trackId: ID!, $first: Int!) {
      spotifyTrack(id: $trackId) {
        __typename
        ... on Error {
          message
        }
        ... on SpotifyTrack {
          similarTracks(target: { library: {} }, searchMode: { complete: {} }, first: $first) {
            __typename
            ... on SimilarTracksError {
              code
              message
            }
            ... on SimilarTracksConnection {
              edges {
                node {
                  __typename
                  id
                  title
                  ... on LibraryTrack {
                    externalId
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const data = await cyaniteGraphql<{
    spotifyTrack:
      | { __typename: 'Error'; message: string }
      | {
          __typename: 'SpotifyTrack';
          similarTracks:
            | { __typename: 'SimilarTracksError'; message: string }
            | {
                __typename: 'SimilarTracksConnection';
                edges: Array<{
                  node: {
                    id: string;
                    title: string;
                    externalId?: string | null;
                  };
                }>;
              };
        };
  }>(query, { trackId: spotifyTrackId, first: limit });

  if (data.spotifyTrack.__typename === 'Error') {
    throw new ApiError(422, data.spotifyTrack.message);
  }
  if (data.spotifyTrack.similarTracks.__typename === 'SimilarTracksError') {
    throw new ApiError(422, data.spotifyTrack.similarTracks.message);
  }

  return data.spotifyTrack.similarTracks.edges.map((edge) => ({
    id: edge.node.id,
    title: edge.node.title,
    externalId: edge.node.externalId,
  }));
};

export const similarLibraryTracksFromLibraryTrack = async (
  libraryTrackId: string,
  limit: number,
): Promise<CyaniteTrackMatch[]> => {
  const query = `
    query LibrarySimilarTracks($trackId: ID!, $first: Int!) {
      libraryTrack(id: $trackId) {
        __typename
        ... on Error {
          message
        }
        ... on LibraryTrack {
          similarTracks(target: { library: {} }, searchMode: { complete: {} }, first: $first) {
            __typename
            ... on SimilarTracksError {
              code
              message
            }
            ... on SimilarTracksConnection {
              edges {
                node {
                  __typename
                  id
                  title
                  ... on LibraryTrack {
                    externalId
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const data = await cyaniteGraphql<{
    libraryTrack:
      | { __typename: 'Error'; message: string }
      | {
          __typename: 'LibraryTrack';
          similarTracks:
            | { __typename: 'SimilarTracksError'; message: string }
            | {
                __typename: 'SimilarTracksConnection';
                edges: Array<{
                  node: {
                    id: string;
                    title: string;
                    externalId?: string | null;
                  };
                }>;
              };
        };
  }>(query, { trackId: libraryTrackId, first: limit });

  if (data.libraryTrack.__typename === 'Error') {
    throw new ApiError(422, data.libraryTrack.message);
  }
  if (data.libraryTrack.similarTracks.__typename === 'SimilarTracksError') {
    throw new ApiError(422, data.libraryTrack.similarTracks.message);
  }

  return data.libraryTrack.similarTracks.edges.map((edge) => ({
    id: edge.node.id,
    title: edge.node.title,
    externalId: edge.node.externalId,
  }));
};
