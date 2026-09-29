/** @type {import("@commitlint/types").UserConfig} */
const config = {
  parserPreset: {
    parserOpts: {
      // Example:
      // [sp-006] Add shared Zod contracts
      //
      // - Point one
      // - Point two
      headerPattern: /^\[(sp-\d+)\]\s(.+)$/i,
      headerCorrespondence: ["type", "subject"],
    },
  },
  rules: {
    // `type` is the ticket id from [sp-006]
    "type-empty": [2, "never"],
    "subject-empty": [2, "never"],
    "subject-case": [0],
    "header-max-length": [2, "always", 100],
    "body-leading-blank": [2, "always"],
    "body-max-line-length": [2, "always", 100],
  },
};

export default config;
