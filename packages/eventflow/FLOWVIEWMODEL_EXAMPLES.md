
```zfl
@import(subscriptions: "http://localhost:8080/subscription/model.zdl")
@import(payments: "com.example.domain:payments:RELEASE")

config {
    basePackage "io.zenwave360.example.subscriptions"
    persistence mongodb
}

systems {
    @zdl("subscription/model.zdl")
    Subscription {
        service SubscriptionService
    }

    @zdl("payments/model.zdl")
    Payments {
        service PaymentService
    }

    @zdl("billing/model.zdl")
    Billing {
        service BillingService
    }
}

/**
 * Payment Flow for Subscription Renewals
 */
flow PaymentsFlow {

    @actor(Customer)
    start CustomerRequestsSubscriptionRenewal {
        subscriptionId String
        customerId String
        paymentMethodId String
    }

    @time("end of month")
    start BillingCycleEnded {
        billingPeriod String
    }

    @time("5 minutes after SubscriptionRenewed and not PaymentSucceeded or PaymentFailed")
    start PaymentTimeout {
    }

    when CustomerRequestsSubscriptionRenewal {
        service Subscription.SubscriptionService
        command renewSubscription
        event SubscriptionRenewed
    }

    when SubscriptionRenewed {
        service Payments.PaymentService
        command chargePayment
        event PaymentSucceeded
        event PaymentFailed
    }

    @if("less than 3 attempts")
    when PaymentFailed {
        service Payments.PaymentService
        command retryPayment
        event PaymentRetryScheduled
    }

    @if("3 or more attempts")
    when PaymentFailed {
        service Subscription.SubscriptionService
        command suspendSubscription
        event SubscriptionSuspended
    }

    when PaymentSucceeded and BillingCycleEnded {
        service Payments.PaymentService
        command recordPayment
        event PaymentRecorded
    }

    when PaymentTimeout {
        service Subscription.SubscriptionService
        command cancelRenewal
        event RenewalCancelled
    }

    end {
        completed: PaymentRecorded
        suspended: SubscriptionSuspended
        cancelled: RenewalCancelled
    }
}
´´´


```json
{
    "schema": "zfl.eventflow.view@1",
    "nodes": [
        {
            "id": "event:CustomerRequestsSubscriptionRenewal",
            "type": "START",
            "label": "CustomerRequestsSubscriptionRenewal",
            "system": null,
            "service": null,
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            },
            "position": {
                "x": 32.0,
                "y": 297.33333333333337
            },
            "dimensions": {
                "width": 180.0,
                "height": 56.0
            }
        },
        {
            "id": "event:BillingCycleEnded",
            "type": "START",
            "label": "BillingCycleEnded",
            "system": null,
            "service": null,
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            },
            "position": {
                "x": 1652.0,
                "y": 116.0
            },
            "dimensions": {
                "width": 180.0,
                "height": 56.0
            }
        },
        {
            "id": "event:PaymentTimeout",
            "type": "START",
            "label": "PaymentTimeout",
            "system": null,
            "service": null,
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            },
            "position": {
                "x": 32.0,
                "y": 36.0
            },
            "dimensions": {
                "width": 180.0,
                "height": 56.0
            }
        },
        {
            "id": "command:renewSubscription",
            "type": "COMMAND",
            "label": "renewSubscription",
            "system": "Subscription",
            "service": "SubscriptionService",
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            },
            "position": {
                "x": 592.0,
                "y": 297.33333333333337
            },
            "dimensions": {
                "width": 180.0,
                "height": 56.0
            }
        },
        {
            "id": "command:chargePayment",
            "type": "COMMAND",
            "label": "chargePayment",
            "system": "Payments",
            "service": "PaymentService",
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            },
            "position": {
                "x": 1392.0,
                "y": 297.33333333333337
            },
            "dimensions": {
                "width": 180.0,
                "height": 56.0
            }
        },
        {
            "id": "command:retryPayment",
            "type": "COMMAND",
            "label": "retryPayment",
            "system": "Payments",
            "service": "PaymentService",
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            },
            "position": {
                "x": 2212.0,
                "y": 632.0
            },
            "dimensions": {
                "width": 180.0,
                "height": 56.0
            }
        },
        {
            "id": "command:suspendSubscription",
            "type": "COMMAND",
            "label": "suspendSubscription",
            "system": "Subscription",
            "service": "SubscriptionService",
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            },
            "position": {
                "x": 2212.0,
                "y": 448.0
            },
            "dimensions": {
                "width": 180.0,
                "height": 56.0
            }
        },
        {
            "id": "command:recordPayment",
            "type": "COMMAND",
            "label": "recordPayment",
            "system": "Payments",
            "service": "PaymentService",
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            },
            "position": {
                "x": 2212.0,
                "y": 126.66666666666666
            },
            "dimensions": {
                "width": 180.0,
                "height": 56.0
            }
        },
        {
            "id": "command:cancelRenewal",
            "type": "COMMAND",
            "label": "cancelRenewal",
            "system": "Subscription",
            "service": "SubscriptionService",
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            },
            "position": {
                "x": 592.0,
                "y": 36.0
            },
            "dimensions": {
                "width": 180.0,
                "height": 56.0
            }
        },
        {
            "id": "event:SubscriptionRenewed",
            "type": "EVENT",
            "label": "SubscriptionRenewed",
            "system": "Subscription",
            "service": "SubscriptionService",
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            },
            "position": {
                "x": 852.0,
                "y": 301.33333333333337
            },
            "dimensions": {
                "width": 160.0,
                "height": 48.0
            }
        },
        {
            "id": "event:PaymentSucceeded",
            "type": "EVENT",
            "label": "PaymentSucceeded",
            "system": "Payments",
            "service": "PaymentService",
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            },
            "position": {
                "x": 1662.0,
                "y": 292.0
            },
            "dimensions": {
                "width": 160.0,
                "height": 48.0
            }
        },
        {
            "id": "event:PaymentFailed",
            "type": "EVENT",
            "label": "PaymentFailed",
            "system": "Payments",
            "service": "PaymentService",
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            },
            "position": {
                "x": 1665.3333333333333,
                "y": 460.0
            },
            "dimensions": {
                "width": 160.0,
                "height": 48.0
            }
        },
        {
            "id": "event:PaymentRetryScheduled",
            "type": "EVENT",
            "label": "PaymentRetryScheduled",
            "system": "Payments",
            "service": "PaymentService",
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            },
            "position": {
                "x": 2472.0,
                "y": 636.0
            },
            "dimensions": {
                "width": 160.0,
                "height": 48.0
            }
        },
        {
            "id": "event:SubscriptionSuspended",
            "type": "EVENT",
            "label": "SubscriptionSuspended",
            "system": "Subscription",
            "service": "SubscriptionService",
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            },
            "position": {
                "x": 2472.0,
                "y": 452.0
            },
            "dimensions": {
                "width": 160.0,
                "height": 48.0
            }
        },
        {
            "id": "event:PaymentRecorded",
            "type": "EVENT",
            "label": "PaymentRecorded",
            "system": "Payments",
            "service": "PaymentService",
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            },
            "position": {
                "x": 2472.0,
                "y": 130.66666666666666
            },
            "dimensions": {
                "width": 160.0,
                "height": 48.0
            }
        },
        {
            "id": "event:RenewalCancelled",
            "type": "EVENT",
            "label": "RenewalCancelled",
            "system": "Subscription",
            "service": "SubscriptionService",
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            },
            "position": {
                "x": 852.0,
                "y": 40.0
            },
            "dimensions": {
                "width": 160.0,
                "height": 48.0
            }
        },
        {
            "id": "policy:CustomerRequestsSubscriptionRenewal:renewSubscription",
            "type": "POLICY",
            "label": "when CustomerRequestsSubscriptionRenewal do renewSubscription",
            "system": null,
            "service": null,
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            },
            "position": {
                "x": 292.0,
                "y": 293.33333333333337
            },
            "dimensions": {
                "width": 220.0,
                "height": 64.0
            }
        },
        {
            "id": "policy:SubscriptionRenewed:chargePayment",
            "type": "POLICY",
            "label": "when SubscriptionRenewed do chargePayment",
            "system": null,
            "service": null,
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            },
            "position": {
                "x": 1092.0,
                "y": 293.33333333333337
            },
            "dimensions": {
                "width": 220.0,
                "height": 64.0
            }
        },
        {
            "id": "policy:PaymentFailed:retryPayment",
            "type": "POLICY",
            "label": "when PaymentFailed do retryPayment if less than 3 attempts",
            "system": null,
            "service": null,
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            },
            "position": {
                "x": 1912.0,
                "y": 628.0
            },
            "dimensions": {
                "width": 220.0,
                "height": 64.0
            }
        },
        {
            "id": "policy:PaymentFailed:suspendSubscription",
            "type": "POLICY",
            "label": "when PaymentFailed do suspendSubscription if 3 or more attempts",
            "system": null,
            "service": null,
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            },
            "position": {
                "x": 1912.0,
                "y": 444.0
            },
            "dimensions": {
                "width": 220.0,
                "height": 64.0
            }
        },
        {
            "id": "policy:PaymentSucceeded,BillingCycleEnded:recordPayment",
            "type": "POLICY",
            "label": "when PaymentSucceeded,BillingCycleEnded do recordPayment",
            "system": null,
            "service": null,
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            },
            "position": {
                "x": 1912.0,
                "y": 122.66666666666666
            },
            "dimensions": {
                "width": 220.0,
                "height": 64.0
            }
        },
        {
            "id": "policy:PaymentTimeout:cancelRenewal",
            "type": "POLICY",
            "label": "when PaymentTimeout do cancelRenewal",
            "system": null,
            "service": null,
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            },
            "position": {
                "x": 292.0,
                "y": 32.0
            },
            "dimensions": {
                "width": 220.0,
                "height": 64.0
            }
        },
        {
            "id": "end:completed",
            "type": "END",
            "label": "Completed",
            "system": null,
            "service": null,
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            },
            "position": {
                "x": 2712.0,
                "y": 126.66666666666666
            },
            "dimensions": {
                "width": 180.0,
                "height": 56.0
            }
        },
        {
            "id": "end:suspended",
            "type": "END",
            "label": "Suspended",
            "system": null,
            "service": null,
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            },
            "position": {
                "x": 2712.0,
                "y": 448.0
            },
            "dimensions": {
                "width": 180.0,
                "height": 56.0
            }
        },
        {
            "id": "end:cancelled",
            "type": "END",
            "label": "Cancelled",
            "system": null,
            "service": null,
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            },
            "position": {
                "x": 1092.0,
                "y": 36.0
            },
            "dimensions": {
                "width": 180.0,
                "height": 56.0
            }
        }
    ],
    "edges": [
        {
            "id": "from[event:CustomerRequestsSubscriptionRenewal]to[policy:CustomerRequestsSubscriptionRenewal:renewSubscription]",
            "source": "event:CustomerRequestsSubscriptionRenewal",
            "target": "policy:CustomerRequestsSubscriptionRenewal:renewSubscription",
            "type": "TRIGGER",
            "label": null,
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            }
        },
        {
            "id": "from[policy:CustomerRequestsSubscriptionRenewal:renewSubscription]to[command:renewSubscription]",
            "source": "policy:CustomerRequestsSubscriptionRenewal:renewSubscription",
            "target": "command:renewSubscription",
            "type": "TRIGGER",
            "label": null,
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            }
        },
        {
            "id": "from[command:renewSubscription]to[event:SubscriptionRenewed]",
            "source": "command:renewSubscription",
            "target": "event:SubscriptionRenewed",
            "type": "CAUSATION",
            "label": null,
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            }
        },
        {
            "id": "from[event:SubscriptionRenewed]to[policy:SubscriptionRenewed:chargePayment]",
            "source": "event:SubscriptionRenewed",
            "target": "policy:SubscriptionRenewed:chargePayment",
            "type": "TRIGGER",
            "label": null,
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            }
        },
        {
            "id": "from[policy:SubscriptionRenewed:chargePayment]to[command:chargePayment]",
            "source": "policy:SubscriptionRenewed:chargePayment",
            "target": "command:chargePayment",
            "type": "TRIGGER",
            "label": null,
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            }
        },
        {
            "id": "from[command:chargePayment]to[event:PaymentSucceeded]",
            "source": "command:chargePayment",
            "target": "event:PaymentSucceeded",
            "type": "CAUSATION",
            "label": null,
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            }
        },
        {
            "id": "from[command:chargePayment]to[event:PaymentFailed]",
            "source": "command:chargePayment",
            "target": "event:PaymentFailed",
            "type": "CAUSATION",
            "label": null,
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            }
        },
        {
            "id": "from[event:PaymentFailed]to[policy:PaymentFailed:retryPayment]",
            "source": "event:PaymentFailed",
            "target": "policy:PaymentFailed:retryPayment",
            "type": "CONDITIONAL",
            "label": null,
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            }
        },
        {
            "id": "from[policy:PaymentFailed:retryPayment]to[command:retryPayment]",
            "source": "policy:PaymentFailed:retryPayment",
            "target": "command:retryPayment",
            "type": "CONDITIONAL",
            "label": null,
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            }
        },
        {
            "id": "from[command:retryPayment]to[event:PaymentRetryScheduled]",
            "source": "command:retryPayment",
            "target": "event:PaymentRetryScheduled",
            "type": "CAUSATION",
            "label": null,
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            }
        },
        {
            "id": "from[event:PaymentFailed]to[policy:PaymentFailed:suspendSubscription]",
            "source": "event:PaymentFailed",
            "target": "policy:PaymentFailed:suspendSubscription",
            "type": "CONDITIONAL",
            "label": null,
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            }
        },
        {
            "id": "from[policy:PaymentFailed:suspendSubscription]to[command:suspendSubscription]",
            "source": "policy:PaymentFailed:suspendSubscription",
            "target": "command:suspendSubscription",
            "type": "CONDITIONAL",
            "label": null,
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            }
        },
        {
            "id": "from[command:suspendSubscription]to[event:SubscriptionSuspended]",
            "source": "command:suspendSubscription",
            "target": "event:SubscriptionSuspended",
            "type": "CAUSATION",
            "label": null,
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            }
        },
        {
            "id": "from[event:PaymentSucceeded]to[policy:PaymentSucceeded,BillingCycleEnded:recordPayment]",
            "source": "event:PaymentSucceeded",
            "target": "policy:PaymentSucceeded,BillingCycleEnded:recordPayment",
            "type": "TRIGGER",
            "label": null,
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            }
        },
        {
            "id": "from[event:BillingCycleEnded]to[policy:PaymentSucceeded,BillingCycleEnded:recordPayment]",
            "source": "event:BillingCycleEnded",
            "target": "policy:PaymentSucceeded,BillingCycleEnded:recordPayment",
            "type": "TRIGGER",
            "label": null,
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            }
        },
        {
            "id": "from[policy:PaymentSucceeded,BillingCycleEnded:recordPayment]to[command:recordPayment]",
            "source": "policy:PaymentSucceeded,BillingCycleEnded:recordPayment",
            "target": "command:recordPayment",
            "type": "TRIGGER",
            "label": null,
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            }
        },
        {
            "id": "from[command:recordPayment]to[event:PaymentRecorded]",
            "source": "command:recordPayment",
            "target": "event:PaymentRecorded",
            "type": "CAUSATION",
            "label": null,
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            }
        },
        {
            "id": "from[event:PaymentTimeout]to[policy:PaymentTimeout:cancelRenewal]",
            "source": "event:PaymentTimeout",
            "target": "policy:PaymentTimeout:cancelRenewal",
            "type": "TRIGGER",
            "label": null,
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            }
        },
        {
            "id": "from[policy:PaymentTimeout:cancelRenewal]to[command:cancelRenewal]",
            "source": "policy:PaymentTimeout:cancelRenewal",
            "target": "command:cancelRenewal",
            "type": "TRIGGER",
            "label": null,
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            }
        },
        {
            "id": "from[command:cancelRenewal]to[event:RenewalCancelled]",
            "source": "command:cancelRenewal",
            "target": "event:RenewalCancelled",
            "type": "CAUSATION",
            "label": null,
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            }
        },
        {
            "id": "from[event:PaymentRecorded]to[end:completed]",
            "source": "event:PaymentRecorded",
            "target": "end:completed",
            "type": "CAUSATION",
            "label": null,
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            }
        },
        {
            "id": "from[event:SubscriptionSuspended]to[end:suspended]",
            "source": "event:SubscriptionSuspended",
            "target": "end:suspended",
            "type": "CAUSATION",
            "label": null,
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            }
        },
        {
            "id": "from[event:RenewalCancelled]to[end:cancelled]",
            "source": "event:RenewalCancelled",
            "target": "end:cancelled",
            "type": "CAUSATION",
            "label": null,
            "sourceRef": {
                "file": "<zfl>",
                "line": 1,
                "column": 1
            }
        }
    ],
    "layout": {
        "engine": "elk-layered",
        "direction": "LR",
        "rankSpacing": 80.0,
        "nodeSpacing": 120.0
    },
    "bounds": {
        "x": 0.0,
        "y": 0.0,
        "width": 2912.0,
        "height": 712.0
    },
    "systemGroups": null
}


```