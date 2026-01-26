/**
 * Instruction Decoder for Z-machine
 *
 * Decodes Z-machine instructions from memory. Each instruction consists of:
 * - Opcode byte (and optionally type bytes)
 * - Operands
 * - Optional store variable
 * - Optional branch offset
 * - Optional inline text (for print/print_ret)
 *
 * There are four instruction forms:
 * - Long (2OP): top 2 bits = 00-01
 * - Short (0OP or 1OP): top 2 bits = 10
 * - Extended (VAR, V5+): opcode = 0xBE
 * - Variable (2OP or VAR): top 2 bits = 11
 *
 * Reference: Z-Machine Specification §4
 *
 * @module
 */

import {
  ByteAddress,
  DecodedInstruction,
  InstructionBytes,
  InstructionForm,
  Operand,
  OperandCount,
  OperandType,
  ZVersion,
} from '../../types/ZMachineTypes';
import { Memory } from '../memory/Memory';
import { get0OPInfo, get1OPInfo, get2OPInfo, getEXTInfo, getVARInfo, OpcodeInfo } from './Opcodes';

/**
 * Decodes Z-machine instructions from memory
 */
export class Decoder {
  private readonly memory: Memory;
  private readonly version: ZVersion;

  /** Text decoder function (injected to avoid circular dependency) */
  private textDecoder?: (address: ByteAddress) => { text: string; bytesConsumed: number };

  constructor(memory: Memory, version: ZVersion) {
    this.memory = memory;
    this.version = version;
  }

  /**
   * Set the text decoder function (called by ZMachine after text module is ready)
   */
  setTextDecoder(decoder: (address: ByteAddress) => { text: string; bytesConsumed: number }): void {
    this.textDecoder = decoder;
  }

  /**
   * Decode the instruction at the given address
   *
   * @param address - Starting address of the instruction
   * @returns Decoded instruction with all fields populated
   */
  decode(address: ByteAddress): DecodedInstruction {
    let offset = 0;
    const opcodeByte = this.memory.readByte(address);
    offset++;

    // Determine instruction form from top 2 bits
    const form = this.determineForm(opcodeByte);

    let instruction: DecodedInstruction;

    switch (form) {
      case InstructionForm.Extended:
        instruction = this.decodeExtended(address, offset);
        break;
      case InstructionForm.Variable:
        instruction = this.decodeVariable(address, offset, opcodeByte);
        break;
      case InstructionForm.Short:
        instruction = this.decodeShort(address, offset, opcodeByte);
        break;
      case InstructionForm.Long:
        instruction = this.decodeLong(address, offset, opcodeByte);
        break;
    }

    return instruction;
  }

  /**
   * Determine instruction form from opcode byte
   */
  private determineForm(opcodeByte: number): InstructionForm {
    // Extended: opcode is 0xBE (V5+)
    if (opcodeByte === InstructionBytes.EXTENDED_OPCODE && this.version >= 5) {
      return InstructionForm.Extended;
    }

    // Variable: top 2 bits = 11
    if ((opcodeByte & InstructionBytes.FORM_MASK) === InstructionBytes.VARIABLE_FORM) {
      return InstructionForm.Variable;
    }

    // Short: top 2 bits = 10
    if ((opcodeByte & InstructionBytes.FORM_MASK) === InstructionBytes.SHORT_FORM) {
      return InstructionForm.Short;
    }

    // Long: top 2 bits = 00 or 01
    return InstructionForm.Long;
  }

  /**
   * Decode a long-form instruction (always 2OP)
   *
   * Bits 6-5 encode operand types:
   * - Bit 6: first operand (0=small constant, 1=variable)
   * - Bit 5: second operand (0=small constant, 1=variable)
   * Bits 4-0: opcode number
   */
  private decodeLong(address: ByteAddress, offset: number, opcodeByte: number): DecodedInstruction {
    const opcode = opcodeByte & InstructionBytes.LONG_OPCODE_MASK;
    const opcodeInfo = get2OPInfo(opcode);

    // Decode operand types from bits 6 and 5
    const type1 =
      opcodeByte & InstructionBytes.LONG_OPERAND1_BIT
        ? OperandType.Variable
        : OperandType.SmallConstant;
    const type2 =
      opcodeByte & InstructionBytes.LONG_OPERAND2_BIT
        ? OperandType.Variable
        : OperandType.SmallConstant;

    // Read operands (both are 1 byte in long form)
    const operand1Value = this.memory.readByte(address + offset);
    offset++;
    const operand2Value = this.memory.readByte(address + offset);
    offset++;

    const operands: Operand[] = [
      { type: type1, value: operand1Value },
      { type: type2, value: operand2Value },
    ];

    return this.finishDecode(
      address,
      offset,
      opcode,
      InstructionForm.Long,
      OperandCount.OP2,
      operands,
      opcodeInfo
    );
  }

  /**
   * Decode a short-form instruction (0OP or 1OP)
   *
   * Bits 5-4 encode operand type:
   * - 00: Large constant (2 bytes)
   * - 01: Small constant (1 byte)
   * - 10: Variable (1 byte)
   * - 11: No operand (0OP)
   * Bits 3-0: opcode number
   */
  private decodeShort(
    address: ByteAddress,
    offset: number,
    opcodeByte: number
  ): DecodedInstruction {
    const opcode = opcodeByte & InstructionBytes.SHORT_OPCODE_MASK;
    const operandTypeBits = (opcodeByte >> 4) & 0x03;

    const operands: Operand[] = [];
    let operandCount: OperandCount;
    let opcodeInfo: OpcodeInfo | undefined;

    if (operandTypeBits === 0x03) {
      // 0OP instruction
      operandCount = OperandCount.OP0;
      opcodeInfo = get0OPInfo(opcode, this.version);
    } else {
      // 1OP instruction
      operandCount = OperandCount.OP1;
      opcodeInfo = get1OPInfo(opcode, this.version);

      const operandType = this.bitsToOperandType(operandTypeBits);
      const { value, bytesRead } = this.readOperand(address + offset, operandType);
      offset += bytesRead;
      operands.push({ type: operandType, value });
    }

    return this.finishDecode(
      address,
      offset,
      opcode,
      InstructionForm.Short,
      operandCount,
      operands,
      opcodeInfo
    );
  }

  /**
   * Decode a variable-form instruction (2OP or VAR)
   *
   * Bit 5 determines operand count:
   * - 0: 2OP (but with variable operand types)
   * - 1: VAR
   * Bits 4-0: opcode number
   *
   * Following byte(s) encode operand types (2 bits each)
   */
  private decodeVariable(
    address: ByteAddress,
    offset: number,
    opcodeByte: number
  ): DecodedInstruction {
    const opcode = opcodeByte & InstructionBytes.LONG_OPCODE_MASK;
    const isVAR = (opcodeByte & InstructionBytes.LONG_OPERAND2_BIT) !== 0;

    // Read operand type byte(s)
    // VAR opcodes call_vs2 and call_vn2 have two type bytes (up to 8 operands)
    const hasDoubleTypes =
      isVAR &&
      (opcode === InstructionBytes.VAR_CALL_VS2 || opcode === InstructionBytes.VAR_CALL_VN2);

    const typeByte1 = this.memory.readByte(address + offset);
    offset++;

    let typeByte2 = 0xff; // All omitted by default
    if (hasDoubleTypes) {
      typeByte2 = this.memory.readByte(address + offset);
      offset++;
    }

    // Decode operand types and read operands
    const operands = this.readOperandsFromTypeBytes(address, offset, typeByte1, typeByte2);
    offset += operands.bytesRead;

    const operandCount = isVAR ? OperandCount.VAR : OperandCount.OP2;
    const opcodeInfo = isVAR ? getVARInfo(opcode) : get2OPInfo(opcode);

    return this.finishDecode(
      address,
      offset,
      opcode,
      InstructionForm.Variable,
      operandCount,
      operands.operands,
      opcodeInfo
    );
  }

  /**
   * Decode an extended-form instruction (V5+, always VAR)
   *
   * Opcode byte is 0xBE, followed by:
   * - Extended opcode number (1 byte)
   * - Operand types (1 byte)
   * - Operands
   */
  private decodeExtended(address: ByteAddress, offset: number): DecodedInstruction {
    const opcode = this.memory.readByte(address + offset);
    offset++;

    const typeByte = this.memory.readByte(address + offset);
    offset++;

    const operands = this.readOperandsFromTypeBytes(address, offset, typeByte, 0xff);
    offset += operands.bytesRead;

    const opcodeInfo = getEXTInfo(opcode);

    return this.finishDecode(
      address,
      offset,
      opcode,
      InstructionForm.Extended,
      OperandCount.VAR,
      operands.operands,
      opcodeInfo
    );
  }

  /**
   * Finish decoding by reading store, branch, and text if needed
   */
  private finishDecode(
    address: ByteAddress,
    offset: number,
    opcode: number,
    form: InstructionForm,
    operandCount: OperandCount,
    operands: Operand[],
    opcodeInfo: OpcodeInfo | undefined
  ): DecodedInstruction {
    const instruction: DecodedInstruction = {
      address,
      length: 0, // Will be set at end
      opcode,
      opcodeName: opcodeInfo?.name ?? 'unknown',
      form,
      operandCount,
      operands,
    };

    // Read store variable if instruction stores
    // Handle version-conditional stores (e.g., sread stores in V5+)
    const storesInThisVersion =
      opcodeInfo?.stores ||
      (opcodeInfo?.storesFromVersion !== undefined && this.version >= opcodeInfo.storesFromVersion);
    if (storesInThisVersion) {
      instruction.storeVariable = this.memory.readByte(address + offset);
      offset++;
    }

    // Read branch data if instruction branches
    if (opcodeInfo?.branches) {
      const branchByte1 = this.memory.readByte(address + offset);
      offset++;

      const branchOnTrue = (branchByte1 & InstructionBytes.BRANCH_CONDITION_BIT) !== 0;

      let branchOffset: number;
      if (branchByte1 & InstructionBytes.BRANCH_SHORT_BIT) {
        // Single-byte offset (bottom 6 bits)
        branchOffset = branchByte1 & InstructionBytes.BRANCH_OFFSET_MASK;
      } else {
        // Two-byte signed offset (bottom 6 bits + next byte)
        const branchByte2 = this.memory.readByte(address + offset);
        offset++;

        // 14-bit signed value
        branchOffset = ((branchByte1 & InstructionBytes.BRANCH_OFFSET_MASK) << 8) | branchByte2;
        // Sign-extend from 14 bits
        if (branchOffset & InstructionBytes.BRANCH_SIGN_BIT) {
          branchOffset = branchOffset - InstructionBytes.BRANCH_SIGN_EXTEND;
        }
      }

      instruction.branch = { branchOnTrue, offset: branchOffset };
    }

    // Read inline text if instruction has text
    if (opcodeInfo?.hasText) {
      if (this.textDecoder) {
        const result = this.textDecoder(address + offset);
        instruction.text = result.text;
        offset += result.bytesConsumed;
      } else {
        // No text decoder yet - skip for now, will need to calculate length differently
        // For now, scan for end marker (high bit set on last word)
        const textStart = offset;
        while (true) {
          const word = this.memory.readWord(address + offset);
          offset += 2;
          if (word & InstructionBytes.TEXT_END_MARKER) break; // High bit marks end of string
        }
        instruction.text = `[text at 0x${(address + textStart).toString(16)}]`;
      }
    }

    instruction.length = offset;
    return instruction;
  }

  /**
   * Convert 2-bit operand type field to OperandType enum
   */
  private bitsToOperandType(bits: number): OperandType {
    switch (bits) {
      case 0b00:
        return OperandType.LargeConstant;
      case 0b01:
        return OperandType.SmallConstant;
      case 0b10:
        return OperandType.Variable;
      default:
        return OperandType.Omitted;
    }
  }

  /**
   * Read an operand value based on its type
   */
  private readOperand(
    address: ByteAddress,
    type: OperandType
  ): { value: number; bytesRead: number } {
    switch (type) {
      case OperandType.LargeConstant:
        return { value: this.memory.readWord(address), bytesRead: 2 };
      case OperandType.SmallConstant:
      case OperandType.Variable:
        return { value: this.memory.readByte(address), bytesRead: 1 };
      case OperandType.Omitted:
        return { value: 0, bytesRead: 0 };
    }
  }

  /**
   * Read operands from type bytes (for variable and extended forms)
   */
  private readOperandsFromTypeBytes(
    baseAddress: ByteAddress,
    startOffset: number,
    typeByte1: number,
    typeByte2: number
  ): { operands: Operand[]; bytesRead: number } {
    const operands: Operand[] = [];
    let offset = 0;

    // Process first type byte (4 operands, 2 bits each, high to low)
    for (let i = 0; i < 4; i++) {
      const typeBits = (typeByte1 >> (6 - i * 2)) & 0x03;
      const type = this.bitsToOperandType(typeBits);

      if (type === OperandType.Omitted) break;

      const { value, bytesRead } = this.readOperand(baseAddress + startOffset + offset, type);
      offset += bytesRead;
      operands.push({ type, value });
    }

    // Process second type byte if present and first wasn't all used up
    if (typeByte2 !== 0xff && operands.length === 4) {
      for (let i = 0; i < 4; i++) {
        const typeBits = (typeByte2 >> (6 - i * 2)) & 0x03;
        const type = this.bitsToOperandType(typeBits);

        if (type === OperandType.Omitted) break;

        const { value, bytesRead } = this.readOperand(baseAddress + startOffset + offset, type);
        offset += bytesRead;
        operands.push({ type, value });
      }
    }

    return { operands, bytesRead: offset };
  }
}
