ALTER TYPE wallet_requests_type_enum
    ADD VALUE IF NOT EXISTS 'ADD_POINTS';

ALTER TYPE wallet_requests_type_enum
    ADD VALUE IF NOT EXISTS 'WITHDRAW';

ALTER TYPE wallet_requests_status_enum
    ADD VALUE IF NOT EXISTS 'PENDING';

ALTER TYPE wallet_requests_status_enum
    ADD VALUE IF NOT EXISTS 'ACCEPTED';

ALTER TYPE wallet_requests_status_enum
    ADD VALUE IF NOT EXISTS 'REJECTED';
