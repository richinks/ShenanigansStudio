import { z } from "zod";

export const SongSchema = z.object({
  song: z.string().min(1),
  artist: z.string().min(1),
  recording_bpm: z.number().int().positive(),
  drummer_click_bpm: z.number().int().positive().optional(),
  time_signature: z.string().regex(/^\d+\/\d+$/),
  feel: z.string().optional(),
  key: z.string().min(1),
  duration_seconds: z.number().int().positive(),
  count_in: z.number().int().nonnegative().optional(),
  backing_track: z.boolean().optional(),
  voice_cue: z.boolean().optional(),
  reaper_status: z.string().optional(),
  x32_scene_status: z.string().optional(),
  source_sheets: z.string().optional(),
  notes: z.string().optional()
});

export function validateSong(data) {
  return SongSchema.safeParse(data);
}
