---
description: Check waveforms and spectrograms, and compare several audio files in the synchronized player.
---

# View audio and compare it at the same position

When you open an audio file, you see a player, the waveform, the spectrogram, and audio information. Both standalone files and audio inside tar files are supported.

<Screenshot src="/screenshots/en/audio-preview.png" alt="Player, waveform, and spectrogram for original.wav" caption="Click the waveform to move the playback position. You can also check the sample rate and codec." />

## Check the waveform and spectrogram

The waveform shows the amplitude of the sound over time, and the spectrogram shows the strength at each frequency. Use them to find where sound starts, silent sections, and differences before and after processing.

Analysis results are cached. The first time, you wait for the analysis to finish, but direct playback and analysis take separate paths. You may be able to play the audio before the waveform is ready.

## Add the original and processed audio to the synchronized player

1. From the file's **Actions** menu (**⋯**), select **Add to player**.
2. Do the same for each audio file you want to compare.
3. In the **Synchronized player** at the bottom of the screen, choose a playback position and play all tracks together.

<Screenshot src="/screenshots/en/audio-deck.png" alt="Synchronized player with original.wav and processed.wav side by side" caption="Play several tracks from the same position. Use mute and solo to switch which audio you hear." />

| Control | What it does |
| --- | --- |
| **Play all** / **Pause** | Control several audio tracks at once |
| **Seek all tracks** | Move every track to the same playback position |
| **Mute** | Silence that track |
| **Solo** | Listen to the selected track |
| L / R | Choose the left or right channel of stereo audio |
| **Delete** | Remove the track from the player |

Removing a track from the player does not delete the file on S3.

## If analysis does not appear, check the connection settings

If **Audio information and waveforms** is turned off for the connection, mado does not run the analysis. **Spectrograms** can also be restricted per connection.

The input limits for analysis are 2 GiB for standalone audio and 100 MiB for audio inside an uncompressed tar. These analysis limits do not apply to direct playback.
