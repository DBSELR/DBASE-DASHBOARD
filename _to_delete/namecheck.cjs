const ts = require('typescript');
const files = ['src/pages/EmpProfile.tsx','src/pages/Sources.tsx','src/utils/apiService.ts'];
const program = ts.createProgram(files, {
  jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler, skipLibCheck: true, noEmit: true,
  allowJs: true, esModuleInterop: true, strict: false
});
let n = 0;
for (const f of files) {
  const sf = program.getSourceFile(f);
  if (!sf) { console.log('SKIP ' + f); continue; }
  const diags = program.getSemanticDiagnostics(sf).filter(d => d.code === 2304 || d.code === 2552);
  console.log(f + ': ' + diags.length + ' undefined-name errors');
  diags.forEach(d => {
    const { line } = sf.getLineAndCharacterOfPosition(d.start);
    n++;
    console.log('   line ' + (line + 1) + ': ' + ts.flattenDiagnosticMessageText(d.messageText, ' '));
  });
}
console.log(n === 0 ? 'NO UNDEFINED NAMES' : 'FOUND ' + n);
