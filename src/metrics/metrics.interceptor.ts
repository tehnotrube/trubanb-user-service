import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram, Gauge } from 'prom-client';
import { Request, Response } from 'express';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  // In-memory visitor tracking (use Redis for production)
  private visitors = new Set<string>();

  constructor(
    @InjectMetric('http_requests_total')
    private readonly httpRequestsTotal: Counter<string>,
    @InjectMetric('http_request_duration_seconds')
    private readonly httpRequestDuration: Histogram<string>,
    @InjectMetric('unique_visitors_total')
    private readonly uniqueVisitors: Gauge<string>,
    @InjectMetric('http_404_errors_total')
    private readonly http404Errors: Counter<string>,
    @InjectMetric('http_request_size_bytes')
    private readonly httpRequestSizeBytes: Counter<string>,
    @InjectMetric('http_response_size_bytes')
    private readonly httpResponseSizeBytes: Counter<string>,
  ) {
    // Clear visitors set every hour
    setInterval(() => {
      this.visitors.clear();
    }, 60 * 60 * 1000);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const startTime = Date.now();

    // Track unique visitor (IP + User-Agent + timestamp rounded to day)
    const userAgent = request.headers['user-agent'] || 'unknown';
    const clientIp = this.getClientIp(request);
    const today = new Date().toISOString().split('T')[0];
    const visitorKey = `${clientIp}-${userAgent}-${today}`;
    this.visitors.add(visitorKey);
    this.uniqueVisitors.set(this.visitors.size);

    // Get route path - normalize to avoid high cardinality
    const route = this.normalizeRoute(request.route?.path || request.path || 'unknown');
    const method = request.method;

    // Track request size
    const requestSize = parseInt(request.headers['content-length'] || '0', 10);
    if (requestSize > 0) {
      this.httpRequestSizeBytes.inc({ method, route }, requestSize);
    }

    return next.handle().pipe(
      tap({
        next: () => {
          this.recordMetrics(method, route, response.statusCode, startTime, response);
        },
        error: (error) => {
          const statusCode = error.status || error.statusCode || 500;
          this.recordMetrics(method, route, statusCode, startTime, response);
        },
      }),
    );
  }

  private recordMetrics(
    method: string,
    route: string,
    statusCode: number,
    startTime: number,
    response: Response,
  ) {
    const duration = (Date.now() - startTime) / 1000;
    const statusCodeStr = statusCode.toString();

    // Record request count
    this.httpRequestsTotal.inc({
      method,
      route,
      status_code: statusCodeStr,
    });

    // Record request duration
    this.httpRequestDuration.observe(
      { method, route, status_code: statusCodeStr },
      duration,
    );

    // Track 404 errors specifically
    if (statusCode === 404) {
      this.http404Errors.inc({ endpoint: route });
    }

    // Track response size
    const responseSize = parseInt(response.get?.('content-length') || '0', 10);
    if (responseSize > 0) {
      this.httpResponseSizeBytes.inc({ method, route }, responseSize);
    }
  }

  // Normalize route to avoid high cardinality (replace IDs with placeholders)
  private normalizeRoute(path: string): string {
    return path
      .replace(/\/\d+/g, '/:id') // Replace numeric IDs like /users/123 -> /users/:id
      .replace(/\/[a-f0-9-]{36}/gi, '/:uuid'); // Replace UUIDs
  }

  // Get client IP address, considering proxies
  private getClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    if (Array.isArray(forwarded)) {
      return forwarded[0];
    }
    return request.ip || request.socket?.remoteAddress || 'unknown';
  }
}
