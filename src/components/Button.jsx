export default function Button({text, style, onClick, ...props}){

  return(

    <button className="button" style={style} onClick={onClick} {...props}>
      {text}
    </button>

  )

}