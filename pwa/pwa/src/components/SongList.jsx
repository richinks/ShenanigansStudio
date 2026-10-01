import { useEffect, useState } from 'react';

export default function SongList() {
  const [songs, setSongs] = useState([]);

  useEffect(() => {
    async function loadSongs() {
      const res = await fetch('/api/song');
      const { songs } = await res.json();
      setSongs(songs);
    }
    loadSongs();
  }, []);

  return (
    <ul>
      {songs.map((s) => (
        <li key={s.song}>{s.song} — {s.artist}</li>
      ))}
    </ul>
  );
}
