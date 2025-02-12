import * as Tone from 'tone';

export class MidiNotePlayer {
  private synth: Tone.PolySynth;
  private notes: string[] = [];
  private currentNoteIndex: number = 0;

  constructor() {
    this.synth = new Tone.PolySynth().toDestination();
    Tone.Transport.bpm.value = 120;
  }

  public setNotes(notes: string[]) {
    this.notes = notes;
    this.currentNoteIndex = 0;
  }

  public async start() {
    await Tone.start();
  }

  public playNextNote() {
    if (this.notes.length === 0) return;

    const note = this.notes[this.currentNoteIndex];
    this.synth.triggerAttackRelease(note, "8n");
    
    this.currentNoteIndex = (this.currentNoteIndex + 1) % this.notes.length;
  }

  public parseMidiNotes(midiNotesStr: string): string[] {
    try {
      // Remove brackets and split by commas
      const notesArray = midiNotesStr
        .replace(/[\[\]']/g, '')
        .split(',')
        .map(note => note.trim());

      // Convert note format if needed (e.g., "Cs5" to "C#5")
      return notesArray.map(note => {
        return note.replace('s', '#');
      });
    } catch (error) {
      console.error('Error parsing MIDI notes:', error);
      return [];
    }
  }
}
