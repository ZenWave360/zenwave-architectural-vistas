import type { FlowViewModel, ServiceViewModel } from '@zenwave360/vistas-eventflow/react';
import placeOrderFlow from './place-order-flow.json';
import placeOrderServices from './place-order-services.json';

/** Sample models for running a page without a host (vite dev). Pages pass them only when import.meta.env.DEV. */
export const devFixtures = {
  flowViewModel: placeOrderFlow as FlowViewModel,
  serviceViewModel: placeOrderServices as ServiceViewModel,
};
