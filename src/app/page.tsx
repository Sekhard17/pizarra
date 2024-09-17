'use client'
import React, { useState, useEffect, useRef } from 'react'
import { supabase } from "@/lib/supabase" // Importar cliente de Supabase
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Pencil, Type, Circle, MessageSquare, Send, Eraser } from "lucide-react"

// Definir la interfaz para los dibujos
interface Drawing {
  id?: number;
  usuario: string;
  inicio_x: number;  
  inicio_y: number;  
  fin_x: number;     
  fin_y: number;     
  color: string;
  herramienta: string; 
  creado_en?: string;
}

export default function Component() {
  const [username, setUsername] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [messages, setMessages] = useState<{ id: number, usuario: string, contenido: string }[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [currentTool, setCurrentTool] = useState('pencil')
  const [currentColor, setCurrentColor] = useState('#000000')
  const [activeUser, setActiveUser] = useState('')
  const [isWriting, setIsWriting] = useState(false)
  const [writingPosition, setWritingPosition] = useState({ x: 0, y: 0 })
  const [drawings, setDrawings] = useState<Drawing[]>([]) 
  const [history, setHistory] = useState<Drawing[][]>([]) // Para "Control Z"
  
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const chatRef = useRef<HTMLDivElement | null>(null)

  // --- Suscripción a los mensajes en tiempo real ---
  useEffect(() => {
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('mensajes')
        .select('*')
        .order('creado_en', { ascending: true });
        
      if (error) console.error(error);
      else setMessages(data || []);
    };

    const messageChannel = supabase
      .channel('realtime:mensajes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensajes' },
        (payload: { new: { id: number, usuario: string, contenido: string } }) => {
          setMessages((prevMessages) => [...prevMessages, payload.new])
        }
      )
      .subscribe()

    fetchMessages()

    return () => {
      supabase.removeChannel(messageChannel)
    }
  }, [])

  // --- Suscripción a los dibujos en tiempo real ---
  useEffect(() => {
    const fetchDrawings = async () => {
      const { data, error } = await supabase
        .from('dibujos')
        .select('*')
        .order('creado_en', { ascending: true });
        
      if (error) console.error(error);
      else setDrawings(data || []);
    };
  
    const drawingsChannel = supabase
      .channel('realtime:dibujos')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'dibujos' },
        (payload: { new: Drawing }) => {
          setDrawings((prevDrawings) => [...prevDrawings, payload.new])
        }
      )
      .subscribe()
  
    fetchDrawings()
  
    return () => {
      supabase.removeChannel(drawingsChannel)
    }
  }, [])

  // --- Enviar un nuevo mensaje ---
  const handleSendMessage = async () => {
    if (newMessage.trim()) {
      const { error } = await supabase
        .from('mensajes')
        .insert([{ usuario: username, contenido: newMessage }])

      if (error) {
        console.error('Error al enviar el mensaje:', error)
      } else {
        setNewMessage('')
        setUnreadMessages(unreadMessages + 1)
      }
    }
  }

  // --- Dibujar en la pizarra y enviar a Supabase ---
  useEffect(() => {
    if (isLoggedIn && canvasRef.current) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null

      if (!ctx) return

      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      let isDrawing = false
      let lastX = 0
      let lastY = 0

      const draw = (e: MouseEvent) => {
        if (!isDrawing) return
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left; // Ajustar las coordenadas del cursor
        const y = e.clientY - rect.top;  // Ajustar las coordenadas del cursor

        ctx.beginPath()
        ctx.moveTo(lastX, lastY)
        ctx.lineTo(x, y)
        ctx.stroke()
        lastX = x
        lastY = y
      }

      const startDrawing = async (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        isDrawing = true
        lastX = e.clientX - rect.left; // Ajustar las coordenadas del cursor
        lastY = e.clientY - rect.top;  // Ajustar las coordenadas del cursor

        ctx.strokeStyle = currentColor
        ctx.lineWidth = currentTool === 'pencil' ? 2 : currentTool === 'brush' ? 5 : 20
        setActiveUser(username)
      
        const { error } = await supabase
          .from('dibujos')
          .insert([{
            usuario: username,
            inicio_x: lastX,
            inicio_y: lastY,
            fin_x: lastX, 
            fin_y: lastY,
            color: currentColor,
            herramienta: currentTool,
          }])
      
        if (error) {
          console.error('Error insertando dibujo:', error.message)
        }
      }

      const stopDrawing = () => {
        isDrawing = false
        setActiveUser('')
      }

      canvas.addEventListener('mousedown', startDrawing)
      canvas.addEventListener('mousemove', draw)
      canvas.addEventListener('mouseup', stopDrawing)
      canvas.addEventListener('mouseout', stopDrawing)

      return () => {
        canvas.removeEventListener('mousedown', startDrawing)
        canvas.removeEventListener('mousemove', draw)
        canvas.removeEventListener('mouseup', stopDrawing)
        canvas.removeEventListener('mouseout', stopDrawing)
      }
    }
  }, [isLoggedIn, currentTool, currentColor, username])

  // --- Deshacer (Control Z) ---
  const undo = () => {
    setDrawings(drawings.slice(0, -1));
    setHistory((prevHistory) => [...prevHistory, drawings]);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') {
        undo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [drawings]);

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (username.trim()) {
      setIsLoggedIn(true)
    }
  }

  // --- Cambiar herramienta de dibujo ---
  const handleToolChange = (tool: string) => {
    setCurrentTool(tool)
    setIsWriting(false)
    if (tool === 'eraser') {
      setCurrentColor('#FFFFFF'); // Cambiar el color a blanco para borrar
    }
  }

  // --- Escribir texto en la pizarra ---
  const handleTextClick = (e: MouseEvent) => {
    if (currentTool === 'text') {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        setWritingPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        setIsWriting(true);
      }
    }
  }

  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.addEventListener('click', handleTextClick);

      return () => {
        canvas.removeEventListener('click', handleTextClick);
      };
    }
  }, [currentTool, canvasRef.current]);

  const handleTextInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isWriting && canvasRef.current) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null

      if (!ctx) return

      ctx.font = '16px Arial'
      ctx.fillStyle = currentColor
      ctx.fillText(e.target.value, writingPosition.x, writingPosition.y)
      setIsWriting(false)
    }
  }

  // --- Manejar el scroll en el chat ---
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [messages])

  // --- Manejar "Enter" para enviar mensaje ---
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  // --- Renderización de la interfaz ---
  if (!isLoggedIn) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-r from-purple-400 via-pink-500 to-red-500">
        <Card className="w-[350px] bg-white bg-opacity-80 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center text-gray-800">Bienvenido al Pizarrón Cooperativo</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Ingresa tu nombre de usuario"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="pl-10 pr-4 py-2 border-2 border-gray-300 rounded-full focus:border-purple-500 focus:ring focus:ring-purple-200 transition duration-200"
                />
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                  <MessageSquare className="h-5 w-5" />
                </span>
              </div>
              <Button type="submit" className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-2 px-4 rounded-full transition duration-200 transform hover:scale-105">
                Entrar al Pizarrón
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100">
      <div className="flex-1 flex p-4 space-x-4 overflow-hidden">
        <div className="flex-1 flex flex-col bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="p-4 bg-gradient-to-r from-purple-400 to-pink-500 text-white flex justify-between items-center">
            <h2 className="text-2xl font-bold">Pizarrón Cooperativo</h2>
            {activeUser && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white text-purple-500 px-3 py-1 rounded-full text-sm font-semibold"
              >
                {activeUser} está dibujando...
              </motion.div>
            )}
          </div>
          <div className="flex space-x-2 p-2 bg-gray-100">
            <TooltipProvider>
              {['pencil', 'brush', 'eraser', 'text'].map((tool) => (
                <Tooltip key={tool}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={currentTool === tool ? 'default' : 'outline'}
                      size="icon"
                      onClick={() => handleToolChange(tool)}
                      className="transition-all duration-200 transform hover:scale-110"
                    >
                      {tool === 'pencil' && <Pencil className="h-4 w-4" />}
                      {tool === 'brush' && <Circle className="h-4 w-4" />}
                      {tool === 'eraser' && <Eraser className="h-4 w-4" />}
                      {tool === 'text' && <Type className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{tool.charAt(0).toUpperCase() + tool.slice(1)}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </TooltipProvider>
            <input
              type="color"
              value={currentColor}
              onChange={(e) => setCurrentColor(e.target.value)}
              className="w-8 h-8 rounded-full overflow-hidden cursor-pointer"
            />
          </div>
          <div className="flex-1 overflow-hidden relative">
            <canvas
              ref={canvasRef}
              width={800}
              height={600}
              className="w-full h-full border border-gray-300 rounded"
            />
            {isWriting && (
              <input
                type="text"
                autoFocus
                onBlur={handleTextInput}
                className="absolute bg-transparent border-none outline-none"
                style={{
                  top: writingPosition.y - 10,
                  left: writingPosition.x,
                  color: currentColor,
                }}
              />
            )}
          </div>
        </div>
        <Card className="w-80 flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Chat</span>
              {unreadMessages > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                  {unreadMessages}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto">
            <div ref={chatRef} className="space-y-2">
              <AnimatePresence>
                {messages.map((msg, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="flex items-start space-x-2"
                  >
                    <Avatar>
                      <AvatarImage src={`https://api.dicebear.com/6.x/initials/svg?seed=${msg.usuario}`} />
                      <AvatarFallback>{msg.usuario.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="bg-gray-100 rounded-lg p-2 max-w-[80%]">
                      <p className="font-semibold text-sm">{msg.usuario}</p>
                      <p className="text-sm">{msg.contenido}</p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-2">
            {isTyping && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-sm text-gray-500"
              >
                {username} está escribiendo...
              </motion.p>
            )}
            <div className="flex space-x-2 w-full">
              <Input
                type="text"
                placeholder="Escribe un mensaje..."
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value)
                  setIsTyping(true)
                  setTimeout(() => setIsTyping(false), 2000)
                }}
                onKeyPress={handleKeyPress}
                className="flex-1"
              />
              <Button size="icon" onClick={handleSendMessage}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
      <footer className="bg-gray-800 text-white py-2 px-4 text-center">
        Creado por Sekhard
      </footer>
    </div>
  )
}
