export function removeInvalidChars(s: string): string {
  return s.replace(/[<>:"/\\|?*\s]/g, '_')
}

export function getCourseFilenameExt(courseLink: string): string {
  const rightIndex = courseLink.indexOf('?')
  const leftIndex = courseLink.lastIndexOf('.', rightIndex >= 0 ? rightIndex : courseLink.length)
  if (leftIndex < 0) return '.mp4'
  return courseLink.slice(leftIndex, rightIndex >= 0 ? rightIndex : undefined)
}

import type { DownloadMode } from '../types'

function shouldIncludeVideo(cdviViewNum: number, mode: DownloadMode): boolean {
  switch (mode) {
    case 'camera':
      return cdviViewNum === 0
    case 'screen':
      return cdviViewNum !== 0
    case 'all':
      return true
  }
}

export function buildDownloadFilenames(
  courses: { subjName: string; userName: string; courName: string; videoPlayResponseVoList: { cdviViewNum: number; rtmpUrlHdv: string }[] }[][],
  mode: DownloadMode
): { links: string[]; filenames: string[] } {
  const links: string[] = []
  const filenames: string[] = []

  for (const subject of courses) {
    for (const course of subject) {
      const sortedVideos = [...course.videoPlayResponseVoList].sort(
        (a, b) => a.cdviViewNum - b.cdviViewNum
      )
      const subjectName = removeInvalidChars(course.subjName)
      const teacherName = removeInvalidChars(course.userName)
      const courseName = removeInvalidChars(course.courName)
      const courseFilenameRaw = `${subjectName}_${teacherName}_${courseName}`
      const courseDirname = `${subjectName}_${teacherName}`

      sortedVideos.forEach((video, i) => {
        if (!shouldIncludeVideo(video.cdviViewNum, mode)) return

        const courseLink = video.rtmpUrlHdv
        const ext = getCourseFilenameExt(courseLink)
        const filename =
          mode === 'all'
            ? `${courseDirname}/${courseFilenameRaw}_${i}${ext}`
            : `${courseDirname}/${courseFilenameRaw}${ext}`
        links.push(courseLink)
        filenames.push(filename)
      })
    }
  }

  return { links, filenames }
}
