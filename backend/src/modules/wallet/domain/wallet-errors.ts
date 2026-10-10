export class WalletDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'WalletDomainError';
  }
}

export class InsufficientBalanceError extends WalletDomainError {
  constructor(message = 'Số dư ví không đủ để thực hiện yêu cầu rút tiền.') {
    super('INSUFFICIENT_WALLET_BALANCE', message);
  }
}

export class MissingBankInfoError extends WalletDomainError {
  constructor(message = 'Shop chưa cài đặt thông tin tài khoản ngân hàng để rút tiền.') {
    super('MISSING_BANK_INFO', message);
  }
}

export class InvalidWithdrawalAmountError extends WalletDomainError {
  constructor(message = 'Số tiền rút không hợp lệ (tối thiểu 50.000 VNĐ).') {
    super('INVALID_WITHDRAWAL_AMOUNT', message);
  }
}

export class WithdrawalNotFoundError extends WalletDomainError {
  constructor(message = 'Không tìm thấy yêu cầu rút tiền.') {
    super('WITHDRAWAL_NOT_FOUND', message);
  }
}

export class EscrowNotFoundError extends WalletDomainError {
  constructor(message = 'Không tìm thấy thông tin ký quỹ của đơn hàng.') {
    super('ESCROW_NOT_FOUND', message);
  }
}

export class EscrowAlreadySettledError extends WalletDomainError {
  constructor(message = 'Ký quỹ đơn hàng đã được quyết toán hoặc hoàn tiền.') {
    super('ESCROW_ALREADY_SETTLED', message);
  }
}
