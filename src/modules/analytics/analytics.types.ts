export interface DateRangeQueryDto {
  startDate?: string;
  start_date?: string;
  endDate?: string;
  end_date?: string;
  months?: number | string;
  period?: string;
}

export interface CustomerAnalyticsQueryDto {
  period?: string; // 'current_cycle', '30d', 'all'
  startDate?: string;
  endDate?: string;
}
