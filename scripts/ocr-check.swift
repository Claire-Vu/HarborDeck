// OCR every committed image (and frames of committed videos) for private strings.
// usage: swift scripts/ocr-check.swift <file>...   (exit 1 on any hit)
import Foundation
import Vision
import AVFoundation
import AppKit

// Generic patterns + this machine's username/home + HD_PRIVATE_NAMES (comma list, kept out of the repo).
// "/Users/me" style placeholders are fine; any other /Users/<x> or ~/.treehouse path is a leak.
var banned = [".treehouse"]
var extra = (ProcessInfo.processInfo.environment["HD_PRIVATE_NAMES"] ?? "").split(separator: ",").map { String($0).lowercased() }
banned += extra
if ProcessInfo.processInfo.environment["CI"] == nil { banned += [NSUserName().lowercased(), NSHomeDirectory().lowercased()] }
let allowedUsers = ["me", "you", "name", "user", "example", "shared"]

func ocr(_ cg: CGImage) -> String {
  let req = VNRecognizeTextRequest()
  req.recognitionLevel = .accurate
  req.usesLanguageCorrection = false
  try? VNImageRequestHandler(cgImage: cg).perform([req])
  return (req.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
}

func hits(_ text: String) -> [String] {
  let low = text.lowercased()
  var out = banned.filter { !$0.isEmpty && low.contains($0) }
  let re = try! NSRegularExpression(pattern: "(?<![\\w.-])/(?:users|home)/([a-z0-9._-]+)")
  for m in re.matches(in: low, range: NSRange(low.startIndex..., in: low)) {
    let user = String(low[Range(m.range(at: 1), in: low)!])
    if !allowedUsers.contains(user) { out.append(String(low[Range(m.range, in: low)!])) }
  }
  return out
}

var bad = 0
for path in CommandLine.arguments.dropFirst() {
  var frames: [CGImage] = []
  let ext = (path as NSString).pathExtension.lowercased()
  if ["mp4", "mov", "webm"].contains(ext) {
    let gen = AVAssetImageGenerator(asset: AVAsset(url: URL(fileURLWithPath: path)))
    gen.appliesPreferredTrackTransform = true
    let dur = AVAsset(url: URL(fileURLWithPath: path)).duration.seconds
    for i in 0..<6 {
      if let f = try? gen.copyCGImage(at: CMTime(seconds: dur * Double(i) / 6, preferredTimescale: 600), actualTime: nil) { frames.append(f) }
    }
  } else if let img = NSImage(contentsOfFile: path), let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) {
    frames = [cg]
  } else { continue }
  var found = Set<String>()
  for f in frames { found.formUnion(hits(ocr(f))) }
  if !found.isEmpty { bad += 1; print("HIT \(path): \(found.sorted().joined(separator: ", "))") }
}
print(bad == 0 ? "ocr-check: clean" : "ocr-check: \(bad) file(s) with private text")
exit(bad == 0 ? 0 : 1)
