/**
 * Core Z-machine types
 *
 * These types are used throughout the emulator and have no external dependencies.
 */

/** Z-machine version number (1-8) */
export type ZVersion = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** A byte address - direct offset into memory (0-65535 for V1-5, larger for V6+) */
export type ByteAddress = number;

/** A word address - multiply by 2 to get byte address */
export type WordAddress = number;

/** A packed address - multiply by 2/4/8 depending on version */
export type PackedAddress = number;

/** An unsigned 16-bit value (0-65535) */
export type Word = number;

/** A signed 16-bit value (-32768 to 32767) */
export type SignedWord = number;

/** A single byte (0-255) */
export type Byte = number;

/** Variable number (0x00 = stack, 0x01-0x0F = locals, 0x10-0xFF = globals) */
export type VariableNumber = number;

/** Object number (1-255 for V1-3, 1-65535 for V4+) */
export type ObjectNumber = number;

/** Property number (1-31 for V1-3, 1-63 for V4+) */
export type PropertyNumber = number;

/** Attribute number (0-31 for V1-3, 0-47 for V4+) */
export type AttributeNumber = number;

/**
 * True color special values for set_true_colour opcode
 * Reference: Z-Machine Specification §8.3.4
 */
export const TrueColor = {
  /** Keep the current color (do not change) */
  KEEP_CURRENT: 0xffff,
  /** Use the default color */
  USE_DEFAULT: 0xfffe,
} as const;

/**
 * Text style flags (can be combined with bitwise OR)
 * Reference: Z-Machine Specification §8.7.2
 */
export const TextStyle = {
  /** Roman (reset all styles) */
  ROMAN: 0,
  /** Reverse video (swap foreground/background) */
  REVERSE_VIDEO: 1,
  /** Bold text */
  BOLD: 2,
  /** Italic text */
  ITALIC: 4,
  /** Fixed-pitch (monospace) font */
  FIXED_PITCH: 8,
} as const;

/**
 * Standard Z-machine color codes
 * Reference: Z-Machine Specification §8.3.1
 */
export const ZColor = {
  /** Current color (no change) */
  CURRENT: 0,
  /** Default color for the platform */
  DEFAULT: 1,
  /** Black */
  BLACK: 2,
  /** Red */
  RED: 3,
  /** Green */
  GREEN: 4,
  /** Yellow */
  YELLOW: 5,
  /** Blue */
  BLUE: 6,
  /** Magenta */
  MAGENTA: 7,
  /** Cyan */
  CYAN: 8,
  /** White */
  WHITE: 9,
  /** Light grey (V6 only) */
  LIGHT_GREY: 10,
  /** Medium grey (V6 only) */
  MEDIUM_GREY: 11,
  /** Dark grey (V6 only) */
  DARK_GREY: 12,
} as const;

/**
 * Output stream numbers
 * Reference: Z-Machine Specification §7.1
 */
export const OutputStream = {
  /** Screen output */
  SCREEN: 1,
  /** Transcript file */
  TRANSCRIPT: 2,
  /** Memory table (for text encoding) */
  MEMORY: 3,
  /** Player input script recording */
  COMMANDS: 4,
} as const;

/**
 * Input stream numbers
 * Reference: Z-Machine Specification §7.2
 */
export const InputStream = {
  /** Keyboard input */
  KEYBOARD: 0,
  /** File input (command playback) */
  FILE: 1,
} as const;

/**
 * Window numbers
 * Reference: Z-Machine Specification §8.7
 */
export const ZWindow = {
  /** Lower/main window (scrolling text) */
  LOWER: 0,
  /** Upper/status window (non-scrolling) */
  UPPER: 1,
} as const;

/**
 * Operand types as encoded in instruction operand type bytes
 *
 * §4.2: Operand types
 */
export enum OperandType {
  /** 2-byte constant (0-65535) */
  LargeConstant = 0b00,
  /** 1-byte constant (0-255) */
  SmallConstant = 0b01,
  /** Variable number (1 byte) */
  Variable = 0b10,
  /** Omitted operand (marks end of operand list) */
  Omitted = 0b11,
}

/**
 * Instruction forms
 *
 * §4.3: Instruction forms
 */
export enum InstructionForm {
  /** Long form: 2OP, operands in bits 6 and 5 */
  Long = 'long',
  /** Short form: 0OP or 1OP based on bits 5-4 */
  Short = 'short',
  /** Extended form: VAR with opcode in next byte (V5+) */
  Extended = 'extended',
  /** Variable form: 2OP or VAR, operand types in following byte(s) */
  Variable = 'variable',
}

/**
 * Operand count categories
 *
 * §4.3.1: Operand counts
 */
export enum OperandCount {
  /** Zero operands */
  OP0 = '0OP',
  /** One operand */
  OP1 = '1OP',
  /** Two operands */
  OP2 = '2OP',
  /** Variable number of operands (0-4 or 0-8) */
  VAR = 'VAR',
}

/**
 * A decoded operand with its type and value
 */
export interface Operand {
  type: OperandType;
  value: number;
}

/**
 * A fully decoded instruction ready for execution
 */
export interface DecodedInstruction {
  /** Address where this instruction starts */
  address: ByteAddress;
  /** Total length of instruction in bytes */
  length: number;
  /** The opcode number */
  opcode: number;
  /** Opcode name for handler dispatch */
  opcodeName: string;
  /** Instruction form */
  form: InstructionForm;
  /** Operand count category */
  operandCount: OperandCount;
  /** Decoded operands */
  operands: Operand[];
  /** Variable to store result (if instruction stores) */
  storeVariable?: VariableNumber;
  /** Branch offset and condition (if instruction branches) */
  branch?: {
    /** True if branch on condition true, false if branch on condition false */
    branchOnTrue: boolean;
    /** Branch offset (0 = return false, 1 = return true, 2+ = PC offset) */
    offset: number;
  };
  /** Inline text (for print/print_ret opcodes) */
  text?: string;
}

/**
 * Result of executing an instruction
 */
export interface ExecutionResult {
  /** The next program counter address */
  nextPC?: ByteAddress;
  /** If set, jump to this address instead of using nextPC */
  jumpTo?: ByteAddress;
  /** If true, execution should halt (quit, fatal error) */
  halted?: boolean;
  /** If set, an error occurred during execution */
  error?: string;
  /** If true, the instruction is waiting for input */
  waitingForInput?: boolean;
}
