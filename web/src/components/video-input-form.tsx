import { FileVideo, Upload } from "lucide-react";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import { getFFmpeg } from "@/lib/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { api } from "@/lib/axios";

type Status = 'waiting' | 'converting' | 'uploading' | 'generation' | 'success'

const statusMessages = {
    converting: 'Convertendo...',
    generation: 'Transcrevendo...',
    success: 'Sucesso!',
    uploading: 'Carregando...',
}

interface VideoInputFormPros {
    onVideoUploaded: (videoId: string) => void
}

export function VideoInputForm(props: VideoInputFormPros) {
    const [videoFile, setVideoFile] = useState<File | null>(null)
    const [status, setStatus] = useState<Status>('waiting')
    const promptInputRef = useRef<HTMLTextAreaElement>(null)

    const previewURL = useMemo(() => {
        if (!videoFile) return null

        return URL.createObjectURL(videoFile)
    }, [videoFile])

    async function convertVideoToAudio(video: File) {
        console.log('Convert started...')

        const ffmpeg = await getFFmpeg()

        await ffmpeg.writeFile('input.mp4', await fetchFile(video))

        // ffmpeg.on('log', log => { console.log(log) })

        ffmpeg.on('progress', progress => {
            console.log('Convert progress: ' + Math.round(progress.progress * 100))
        })

        await ffmpeg.exec([
            '-i',
            'input.mp4',
            '-map',
            '0:a',
            '-b:a',
            '20k',
            '-acodec',
            'libmp3lame',
            'output.mp3'
        ])

        const data = await ffmpeg.readFile('output.mp3')

        const audioFileBlob = new Blob([data], { type: 'audio/mpeg' })
        const audioFile = new File([audioFileBlob], 'audio.mp3', { type: 'audio/mpeg' })

        console.log('Convert finished!')

        return audioFile
    }

    function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
        const { files } = event.currentTarget

        if (!files) return

        const selectedFile = files[0]

        setVideoFile(selectedFile)
    }

    async function handleUploadVideo(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()

        if (!videoFile) return

        setStatus('converting')

        const audioFile = await convertVideoToAudio(videoFile)

        const data = new FormData()

        data.append('file', audioFile)

        setStatus('uploading')

        const response = await api.post('/videos', data)

        const prompt = promptInputRef.current?.value
        const videoId = response.data.video.id

        setStatus('generation')

        await api.post(`/videos/${videoId}/transcription`, { prompt })

        console.log('Finalizou!')

        setStatus('success')

        props.onVideoUploaded(videoId)
    }

    return (
        <form className="space-y-6" onSubmit={handleUploadVideo}>
            <label
                className="relative border flex w-full rounded-md aspect-video cursor-pointer border-dashed text-sm flex-col gap-2 items-center justify-center text-muted-foreground hover:bg-primary/20"
                htmlFor="video"
            >
                {previewURL ? (
                    <video src={previewURL} controls={false} className="pointer-events-none absolute inset-0" />
                ) : (
                    <>
                        <FileVideo className="w-4 h-4" />
                        Carregar vídeo
                    </>
                )}
            </label>

            <input
                accept="video/mp4"
                className="sr-only"
                id="video"
                type="file"
                onChange={handleFileSelected}
            />

            <Separator />

            <div className="space-y-2">
                <Label htmlFor="transcription-prompt">Prompt de transcrição</Label>

                <Textarea
                    className="h-20 leading-relaxed resize-none"
                    disabled={status !== 'waiting'}
                    id="transcription-prompt"
                    placeholder="Inclua palavras-chave mencionadas no vídeo separadas por vírgula (,)"
                    ref={promptInputRef}
                />
            </div>

            <Button
                className="w-full data-[success=true]:bg-emerald-400"
                data-success={status === 'success'}
                disabled={status !== 'waiting'}
                type="submit"
            >
                {status === 'waiting' ? (
                    <>
                        Carregar Vídeo
                        <Upload className="w-4 h4 ml-2" />
                    </>
                ) : statusMessages[status]
                }
            </Button>
        </form>
    )
}
