import { CallType, CallStatus } from '../../shared/types/models';

export interface IngestCdrDto {
  sourceCallId?: string;
  source_call_id?: string;
  callerNumber?: string;
  caller_number?: string;
  callerMsisdn?: string;
  caller_msisdn?: string;
  receiverNumber?: string;
  receiver_number?: string;
  receiverMsisdn?: string;
  receiver_msisdn?: string;
  callType?: CallType | string;
  call_type?: CallType | string;
  status?: CallStatus | string;
  startTime?: string | Date;
  start_time?: string | Date;
  endTime?: string | Date;
  end_time?: string | Date;
  durationSeconds?: number;
  duration_seconds?: number;
}

export interface SimulateTrafficDto {
  callCount?: number;
  call_count?: number;
  dateRange?: {
    startDate?: string;
    start_date?: string;
    endDate?: string;
    end_date?: string;
  };
  date_range?: {
    startDate?: string;
    start_date?: string;
    endDate?: string;
    end_date?: string;
  };
}

export interface CdrQueryDto {
  page?: number | string;
  limit?: number | string;
  customerId?: string;
  customer_id?: string;
  callType?: string;
  call_type?: string;
  isBilled?: string | boolean;
  is_billed?: string | boolean;
}
