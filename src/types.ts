export interface AudioSegment {
  buffer: AudioBuffer;
  startTime: number;
  duration: number;
}

export interface TextElement {
  id: string;
  text: string;
  x: number;
  y: number;
  font: string;
  size: number;
  color: string;
  isDragging: boolean;
  isBold: boolean;
}
