export interface AirtableAttachment {
  id: string;
  url: string;
  filename: string;
  size?: number;
  type?: string;
}

export interface SeriesFields {
  Name: string;
  Notes?: string;
  Attachments?: AirtableAttachment[];
  Status?: string;
  "Machine Name"?: string;
  Pucks?: string[];
  "Count in Series"?: number;
}

export interface PuckFields {
  Name: string;
  Series?: string[];
  Attachments?: AirtableAttachment[];
  Status?: string;
  URL?: string;
  "Series Number"?: number;
  Created?: string;
  "Photo URL"?: string;
  "Name (from series)"?: string[];
  "Series machine name"?: string[];
  "Shortened URL"?: string;
  Notes?: string;
  "Date hidden"?: string;
  "Shortened Name"?: string;
  "Number in Series"?: number;
}

export interface Series {
  id: string;
  name: string;
  slug: string;
  notes: string | null;
  status: string | null;
  countInSeries: number | null;
  imageUrl: string | null;
}

export interface Puck {
  id: string;
  name: string;
  slug: string;
  seriesSlug: string;
  seriesName: string;
  status: string;
  seriesNumber: number | null;
  created: string | null;
  imageUrl: string | null;
  shortenedUrl: string | null;
  shortenedName: string | null;
  notes: string | null;
}
