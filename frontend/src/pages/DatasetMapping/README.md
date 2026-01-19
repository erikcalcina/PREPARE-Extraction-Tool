# Dataset Mapping Feature

## Overview

The Dataset Mapping feature allows you to map clusters of extracted source terms to standardized vocabulary concepts using semantic search and interactive review.

## Quick Start

1. Navigate to a dataset with clustered terms
2. From the **Term Clustering** page, click **"Mapping →"** button
3. Select vocabularies to search against
4. Click **"Auto-Map All Unmapped"** or review clusters individually
5. Approve/reject mappings and export results

## Features

### Automatic Initial Mapping
- Click "Auto-Map" on any cluster to get concept suggestions
- Uses cluster title + top terms for intelligent matching
- Powered by hybrid search (text + semantic embeddings)
- Returns top 10 candidates with match scores

### Filtering & Search
- **Vocabularies**: Select multiple vocabularies to search
- **Domain Filter**: Filter by concept domain (e.g., "Condition", "Procedure")
- **Concept Class Filter**: Filter by concept class (e.g., "Clinical Finding")
- **Standard Concepts Only**: Toggle to show only standard concepts

### Interactive Review
- **Unmapped** (gray): No mapping assigned yet
- **Pending** (yellow): Mapping created, awaiting review
- **Approved** (green): Mapping reviewed and approved
- **Rejected** (red): Mapping rejected

### Bulk Operations
- **Auto-Map All Unmapped**: Automatically map all unmapped clusters
- **Export Mappings**: Download as CSV (source_to_concept_map format)
- **Import Mappings**: Apply old mappings from CSV

### Concept Details
- Click "View Details" on any concept to see:
  - Full concept information (ID, code, domain, class)
  - Parent concepts (if available)
  - Child concepts (if available)
  - Related concepts (if available)

## Workflow

```
Extract Terms → Cluster Terms → Map Clusters → Export Mappings
(Records page)  (Clusters page)  (Mapping page)  (CSV download)
```

## UI Layout

### Left Panel: Clusters List
- Browse all clusters with their mapping status
- Search by cluster title or mapped concept name
- Click to select and view details

### Middle Panel: Cluster Details
- View selected cluster information
- See current mapping (if exists)
- Approve/reject/remove mappings
- Auto-map button for unmapped clusters

### Right Panel: Concept Suggestions
- View auto-suggested concepts with match scores
- Quick map to selected cluster
- View detailed concept information

## API Endpoints

- `GET /datasets/{id}/mappings` - Get all cluster mappings
- `POST /datasets/{id}/clusters/{cluster_id}/auto-map` - Auto-map cluster
- `POST /datasets/{id}/clusters/{cluster_id}/map` - Map cluster to concept
- `DELETE /datasets/{id}/clusters/{cluster_id}/mapping` - Remove mapping
- `POST /datasets/{id}/auto-map-all` - Bulk auto-map
- `GET /concepts/search` - Search concepts
- `GET /concepts/{id}/hierarchy` - Get concept details
- `GET /datasets/{id}/mappings/export` - Export CSV
- `POST /datasets/{id}/mappings/import` - Import CSV

## Database Schema

The `source_to_concept_map` table now includes:
- `cluster_id` - ID of the mapped cluster
- `concept_id` - ID of the mapped concept
- `status` - Mapping status (unmapped/pending/approved/rejected)
- `created_at` - When mapping was created
- `updated_at` - When mapping was last modified

## Tips

1. **Start with Auto-Map All**: Get initial suggestions for all clusters quickly
2. **Review High Scores First**: Focus on mappings with >80% match scores
3. **Use Filters**: Narrow down results with domain/class filters
4. **View Concept Details**: Check parent/child relationships before approving
5. **Export Regularly**: Save approved mappings as you go
6. **Reuse Old Mappings**: Import previous mappings when updating datasets

## Troubleshooting

### No concept suggestions appearing
- Check that vocabularies are selected
- Verify Elasticsearch is running and indexed
- Try removing filters to broaden search

### Auto-map fails
- Ensure cluster has terms (not empty)
- Check that selected vocabularies are valid
- Verify network connectivity to backend

### Import fails
- Check CSV format matches export format
- Verify cluster titles match exactly
- Ensure concept IDs exist in database

## Next Steps

After mapping clusters to concepts, you can:
1. Export the mappings as CSV
2. Use the mappings in downstream analysis
3. Apply mappings to new data when vocabulary updates
4. Share mappings with collaborators
