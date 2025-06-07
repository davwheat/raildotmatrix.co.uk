export default function getAAnSimple(text: string): 'a' | 'an' {
  const char = text.trim().toLowerCase().substring(0, 1)

  if ([...'aeiou'].includes(char)) {
    return 'an'
  } else {
    return 'a'
  }
}
