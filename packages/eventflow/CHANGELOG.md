# @zenwave360/vistas-eventflow

## 0.2.0

### Minor Changes

- 4371e57: The opening view frames when a diagram is first shown and when its `diagramId` changes, and keeps the user's pan and zoom when nodes are added, removed or reordered. `renderBundle` and the visualizers take an optional `diagramId`: a host should send something stable for one diagram, such as the document URI and the flow name. The protocol version stays 1.
