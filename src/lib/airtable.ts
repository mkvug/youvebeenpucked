const AIRTABLE_API_BASE = "https://api.airtable.com/v0";

export interface AirtableRecord<TFields> {
  id: string;
  createdTime: string;
  fields: TFields;
}

interface ListResponse<TFields> {
  records: AirtableRecord<TFields>[];
  offset?: string;
}

function getConfig(): { token: string; baseId: string } {
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!token) {
    throw new Error("Missing AIRTABLE_TOKEN environment variable.");
  }
  if (!baseId) {
    throw new Error("Missing AIRTABLE_BASE_ID environment variable.");
  }
  return { token, baseId };
}

/** Fetches every record from an Airtable table, following the `offset` pagination cursor. */
export async function fetchAllRecords<TFields>(tableName: string): Promise<AirtableRecord<TFields>[]> {
  const { token, baseId } = getConfig();
  const records: AirtableRecord<TFields>[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(`${AIRTABLE_API_BASE}/${baseId}/${encodeURIComponent(tableName)}`);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Airtable request failed (${response.status} ${response.statusText}) for table "${tableName}": ${body}`,
      );
    }

    const data = (await response.json()) as ListResponse<TFields>;
    records.push(...data.records);
    offset = data.offset;
  } while (offset);

  return records;
}
