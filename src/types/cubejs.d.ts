declare module "cubejs" {
  /**
   * Tipi minimi per `cubejs` (solver di Kociemba a due fasi).
   * Copre solo ciò che usiamo: init del solver e solve da stringa facelet.
   */
  export default class Cube {
    /** Costruisce le tabelle di pruning. Bloccante (~1s), da chiamare una volta. */
    static initSolver(): void;
    /** Crea un cubo da una stringa facelet di 54 caratteri (ordine URFDLB). */
    static fromString(facelets: string): Cube;
    static random(): Cube;
    static scramble(): string;

    move(sequence: string): Cube;
    solve(maxDepth?: number): string;
    asString(): string;
    isSolved(): boolean;
  }
}
