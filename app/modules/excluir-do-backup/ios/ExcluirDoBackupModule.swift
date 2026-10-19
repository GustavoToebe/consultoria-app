import ExpoModulesCore
import Foundation

/**
 * Tira um arquivo ou pasta do backup do iCloud (e do backup pelo computador): marca a URL com
 * `URLResourceValues.isExcludedFromBackup`. Numa pasta, vale para tudo o que estiver dentro dela, inclusive o que for
 * criado depois. O Expo não tem API para isso.
 *
 * Por quê (revisão de segurança de 19/10): o expo-sqlite grava em `Documents/SQLite` e as fotos pendentes da atualização
 * ficam em `Documents/fotos`; o iOS manda `Documents` para o backup do iCloud por padrão, e lá iriam treino, dieta,
 * respostas e fotos de corpo do aluno (dado sensível, LGPD). No Android isso é o `allowBackup: false` do `app.json`.
 *
 * Nunca lança: caminho vazio, que não existe ou que o sistema recusou devolve `false` (o app segue funcionando).
 */
public final class ExcluirDoBackupModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExcluirDoBackup")

    AsyncFunction("excluir") { (caminho: String) -> Bool in
      return excluirDoBackup(caminho)
    }
  }
}

/** Aceita caminho absoluto (`/var/.../Documents/SQLite`) ou URI de arquivo (`file:///var/.../Documents/fotos/`). */
private func urlDoArquivo(_ caminho: String) -> URL? {
  if caminho.hasPrefix("file://") {
    if let url = URL(string: caminho), url.isFileURL {
      return url
    }
    let semEsquema = String(caminho.dropFirst("file://".count))
    return URL(fileURLWithPath: semEsquema.removingPercentEncoding ?? semEsquema)
  }
  if caminho.hasPrefix("/") {
    return URL(fileURLWithPath: caminho)
  }
  return nil
}

private func excluirDoBackup(_ caminho: String) -> Bool {
  guard var url = urlDoArquivo(caminho) else {
    return false
  }
  guard FileManager.default.fileExists(atPath: url.path) else {
    return false
  }
  var valores = URLResourceValues()
  valores.isExcludedFromBackup = true
  do {
    try url.setResourceValues(valores)
    return true
  } catch {
    return false
  }
}
