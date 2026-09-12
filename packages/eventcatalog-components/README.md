# @zenwave360/eventcatalog-components

Installable Astro components for EventCatalog projects.

```bash
pnpm add @zenwave360/eventcatalog-components
```

```mdx
import RemoteSpecificationSchema from '@zenwave360/eventcatalog-components/RemoteSpecificationSchema';

<RemoteSpecificationSchema
  url="https://contracts.example.com/asyncapi.yml"
  message="OrderCreated"
/>
```

The initial `RemoteSpecificationSchema` component is migrated from the local EventCatalog project component. Its use of EventCatalog's internal schema viewers is retained temporarily and must be replaced by a public or package-owned viewer before the package is considered stable.
