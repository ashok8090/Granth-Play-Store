# Architecture

```
React Native UI (screens + FlatList)
        ↓
Navigation (native stack + bottom tabs)
        ↓
AppProvider
        ↓
Services (search, catalog, downloads, PDF, gallery, packs)
        ↓
SQLite (expo-sqlite) + files (expo-file-system) + MediaStore
```

Not HTML → WebView → website.

## Layers

| Path | Role |
| --- | --- |
| `src/screens` | Dashboard, Topics, Granths, Pramans, Gallery, Downloads |
| `src/components` | Header, search, grid switch, cards, image with download button |
| `src/navigation/RootNav.tsx` | Tabs and gallery/download stack. No web view |
| `src/state/AppProvider.tsx` | Boot, sync, settings, toasts |
| `src/database/db.ts` | SQLite schema and queries |
| `src/search/SearchService.ts` | `normalizeText`, `transliterateQuery`, `fuzzyMatch`, `calculateRelevance`, `searchTopics`, `searchGranth`, `searchPramaan` |
| `src/services/CatalogService.ts` | `getTopics` / `getGranths` / `getPramans`, then local replace |
| `src/services/DownloadService.ts` | Queue, 2 workers, pause/resume (`DownloadResumable`), retry, cancel, duplicate id |
| `src/services/StorageService.ts` | App directories, base64, JPEG/PNG check |
| `src/services/PdfService.ts` | pdf-lib + Noto font. Image keeps aspect ratio. Text paginates on A4 |
| `src/services/GalleryService.ts` | Gallery rows, MediaStore album, SAF PDF export, share |
| `src/services/ResourcePackService.ts` | Version compare and JSON/zip import |
| `src/services/settings.ts` | Column counts and theme in AsyncStorage |

## Data

SQLite `granth.db`:

- `topics`, `granths`, `pramans` — catalog, separate from UI code
- `files` — cached image path → local uri + size
- `folders`, `gallery` — user album and metadata
- `downloads` — queue snapshot so a restart can resume
- `meta` — `syncedAt`, `resourceVersion` (default `1.0.0`), SAF directory

Files:

- `granth/images` — original downloads, skipped when the file is already valid
- `granth/gallery` — user copies
- `granth/pdfs` — generated card PDFs
- `granth/packs` — imported packs

## Offline search

No network model. Pipeline:

1. Unicode NFC, lowercasing, punctuation strip
2. Matra strip
3. Devanagari → Latin
4. Synonym clusters (मांस/mans, मृत्यु/mrityu, ब्रह्म/brahm, कृष्ण, कबीर, गीता/gita, …)
5. Levenshtein on short tokens
6. Multi-word needs: a query like “ब्रह्मा की मृत्यु” scores documents that contain the concepts even when the exact phrase is absent

Results are sorted by score. Hundreds of rows stay in memory; lists are virtualized.

## Resource packs

```json
{
  "resourceVersion": "1.1.0",
  "topics": [],
  "granths": [],
  "pramans": []
}
```

A `.zip` with one JSON file of that shape is accepted. Import is rejected when the pack version is older than the installed version. Images stay addressable by `granths/…` and `uploads/…` and download through the same queue.

## Performance

- `FlatList` windowing, `removeClippedSubviews`, memoized cards
- Image decode uses the cached file once it exists; remote URLs are only the fallback
- Download progress updates are throttled
- PDF font bytes are cached after the first embed
- Search does not scan with a cloud API

## Android storage

- Pictures: `expo-media-library` → MediaStore album “ग्रंथ प्रबंधन”
- PDFs: app documents plus Storage Access Framework so the user picks Downloads or another folder
- Sharing: `expo-sharing`
