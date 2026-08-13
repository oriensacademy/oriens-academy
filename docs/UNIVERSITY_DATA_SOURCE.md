# University discovery data source

## Source

Oriens imports institution-discovery metadata from the official OpenAlex
Institutions API, filtered to `type:education` and `has_ror:true`.

- API: `https://api.openalex.org/institutions`
- License: CC0
- Stable identity: OpenAlex institution ID
- Secondary identity: ROR ID
- Coverage at implementation time: 26,438 education institutions with ROR IDs

## Imported fields

- canonical display name and normalized search name
- OpenAlex ID and ROR ID
- ISO country identity
- city, region, latitude, and longitude
- official homepage when supplied
- source-provided acronyms and alternative display names
- publication count, used only as a bounded discovery popularity signal

## Inclusion and limitations

Only OpenAlex institutions classified as `education` and carrying a ROR ID are
included. Healthcare, company, archive, nonprofit, government, facility, and
other records are excluded. OpenAlex is an affiliation/research graph, so an
education provider with little research metadata may be absent. OpenAlex does
not reliably classify public/private governance, so imported records use
`OTHER` rather than inventing a governance claim.

This pipeline imports institution discovery metadata only. It does not create
programs, admission requirements, qualification acceptance claims, rankings,
or eligibility decisions.

