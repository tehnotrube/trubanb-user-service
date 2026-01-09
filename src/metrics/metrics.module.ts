import { Module, Global } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import {
  PrometheusModule,
  makeCounterProvider,
  makeHistogramProvider,
  makeGaugeProvider,
} from '@willsoto/nestjs-prometheus';
import { MetricsService } from './metrics.service';
import { MetricsInterceptor } from './metrics.interceptor';

@Global()
@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: {
        enabled: true,
      },
    }),
  ],
  providers: [
    MetricsService,
    MetricsInterceptor,
    // Register interceptor globally from within this module
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
    // HTTP Requests Counter
    makeCounterProvider({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
    }),
    // HTTP Request Duration Histogram
    makeHistogramProvider({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
    }),
    // Unique Visitors Gauge
    makeGaugeProvider({
      name: 'unique_visitors_total',
      help: 'Number of unique visitors (IP + User-Agent)',
    }),
    // 404 Errors Counter
    makeCounterProvider({
      name: 'http_404_errors_total',
      help: 'Total number of 404 errors',
      labelNames: ['endpoint'],
    }),
    // Request Size Counter
    makeCounterProvider({
      name: 'http_request_size_bytes',
      help: 'Total HTTP request size in bytes',
      labelNames: ['method', 'route'],
    }),
    // Response Size Counter
    makeCounterProvider({
      name: 'http_response_size_bytes',
      help: 'Total HTTP response size in bytes',
      labelNames: ['method', 'route'],
    }),
  ],
  exports: [PrometheusModule, MetricsService],
})
export class MetricsModule {}
